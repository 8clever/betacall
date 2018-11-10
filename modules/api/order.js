
let api = {};
let ctx = null;

const __ = require("./__namespace");
const soap = require("soap");
const _ = require("lodash");
const md5 = require("md5");
const moment = require("moment");
const async = require("async");
const COLLECTION = __.ESSENCE;

let topDelivery = null;
let topDeliveryCfg = null;
let __orders = [];
let __pickups = _.groupBy(require("../../public/pickupPoint.json"), "partnerId");
let cols = {};
let callQueue = null;
let callTimes = {};

module.exports.deps = ['mongo', 'obac', 'settings'];
module.exports.init = async function(...args) {
    [ctx] = args;

    topDeliveryCfg = ctx.cfg.topDelivery;
    topDelivery = await soap.createClientAsync(ctx.cfg.topDelivery.url);
    topDelivery.setSecurity(new soap.BasicAuthSecurity(
        topDeliveryCfg.basicAuth.user,
        topDeliveryCfg.basicAuth.password
    ));

    const validateStat = {
        $set: {
			properties: {
				_id: {
					type: "mongoId"
				},
				_iduser: {
					type: "mongoId",
					required: true
                },
                orderId: {
                    type: "number",
                    required: true
                },
                status: {
                    type: "string",
                    required: true
                },
                _dt: {
                    type: "date",
                    required: true
                },
                _dtnextCall: {
                    type: "date"
                }
			}
		}
    }
    
    ctx.api.validate.register(COLLECTION.STATS, validateStat);
    ctx.api.validate.register(COLLECTION.STATS_ALL, validateStat);

	let db = await ctx.api.mongo.getDb({});
    
    cols[COLLECTION.STATS] = await db.collection(COLLECTION.STATS);
    cols[COLLECTION.STATS_ALL] = await db.collection(COLLECTION.STATS_ALL);

    await ctx.api.mongo.ensureIndex(cols[COLLECTION.STATS], { orderId: 1 });
    await ctx.api.mongo.ensureIndex(cols[COLLECTION.STATS], { status: 1 });
    
    api.getStats = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.STATS]);
    api.getStatsAll = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.STATS_ALL]);
    api.addStats = ctx.api.coreapi.initEditApiFunction({
        collection: cols[COLLECTION.STATS],
        validate: COLLECTION.STATS
    });

    if (!ctx.cfg.ami.maxQueue) return { api };

    callQueue = async.queue(function({ name, fn }, cb) {
        callQueue.tasks = callQueue.tasks || {};
        callQueue.tasks[name] = 1;
        let exit = false;
        let timeout = setTimeout(() => {
            console.log("call queue not respond more than 3 minutes");
            callback();
        }, 1000 * 60 * 3)

        fn().then(response => {
            callback(null, response);
        }).catch(err => {
            callback(err);
        });

        function callback (...args) {
            if (exit) return;
            exit = true;
            delete callQueue.tasks[name];
            clearTimeout(timeout);
            cb(...args);
        }
    }, ctx.cfg.ami.maxQueue);
    callQueue.tasks = {};

    return { api }
}

/** 
 * GET CALL ORDERS FROM Top Delivery 
 * And update call times
 * used by scheduller each 15 minutes
 * 
 * */
api._getCallOrders = async function(t, p) {

    // set/update call times
    let settings = await ctx.api.settings.getSettings(t, {});
    _.each(settings.timeCalls, timeCall => {
        callTimes[ timeCall.region ] = {
            from: moment().startOf("day").add(timeCall._i_start, "hours").toDate(),
            to: moment().startOf("day").add(timeCall._i_end, "hours").toDate()
        }
    });

    let [ orders ] = await topDelivery.getCallOrdersAsync({
        auth: topDeliveryCfg.bodyAuth
    });

    _.each(orders.orderInfo, order => {
        let partnerId = _.get(order, "partnerExecutor.id");
        if (!(
            partnerId &&
            __pickups[partnerId]
        )) return;
        
        order.pickupPoints = __pickups[partnerId];
    });

    __orders = orders.orderInfo;
    let ordersIds = _.map(__orders, "orderIdentity.orderId");
    let query = { orderId: { $nin: ordersIds }};
    let expireOrders = await this.getStats(t, { query });
    if (!expireOrders.count) return;

    await Promise.all([
        cols[COLLECTION.STATS_ALL].insert(expireOrders.list),
        cols[COLLECTION.STATS].remove(query)
    ]);
}



/**
 * p.page
 * p.limit
 * p.query
 */
api.getOrders = async function(t, p) {
    await ctx.api.users.getCurrentUserPublic(t, {});
    let orders = __orders.concat([]);

    if (p.query) {
        _.each(p.query, (v, k) => {
            let regexp = new RegExp(v);
            orders = _.filter(orders, o => {
                let value = _.get(o, k);
                return regexp.test(value);
            });
        });
    }

    let count = orders.length;

    if (p.limit) {
        let limit = parseInt(p.limit);
        let page = parseInt(p.page || 0);
        let skip = page * limit;
        orders = orders.slice(skip, skip + limit);
    }

    return {
        list: orders,
        count
    };
}

api.getOrderByID = async function(t, { orderId }) {
    if (!orderId) throw new Error("Invalid order id");
    await ctx.api.users.getCurrentUserPublic(t, {});
    let order = _.find(__orders, _.matchesProperty("orderIdentity.orderId", orderId));
    if (!order) throw new Error("Order by id not found");
    return order;
}

api.getOrderByPhone = async function(t, { phone }) {
    if (!phone) throw new Error("Invalid phone number");
    await ctx.api.users.getCurrentUserPublic(t, {});
    let order = _.find(__orders, _.matchesProperty("clientInfo.phone", phone.toString()));
    if (!order) throw new Error("Order by phone not found!");
    return order;
}

api.getMyOrders = async function(t, p) {
    let u = await ctx.api.users.getCurrentUserPublic(t, {});
    let orders = [];

    for (let { orderId } of u.orders || []) {
        try {
            let order = await this.getOrderByID(t, { orderId });
            orders.push({ info: order });
        } catch(err) {/** empty */}
    }

    return orders;
}

api.addToMyOrders = async function(t, { orderId }) {
    if (!orderId) throw new Error("Invalid order id");
    let u = await ctx.api.users.getCurrentUserPublic(t, {});

    u.orders = u.orders || [];
    let orderAlreadyMy = _.find(u.orders, _.matchesProperty("orderId", orderId));
    if (orderAlreadyMy) return;

    u.orders.push({ orderId: orderId });

    await ctx.api.users.editUser(t, { data: {
        _id: u._id,
        orders: u.orders
    }});
}

api.unsetMyOrder = async function(t, { orderId }) {
    if (!orderId) throw new Error("Invalid order id");
    let u = await ctx.api.users.getCurrentUserPublic(t, {});
    u.orders = u.orders || [];
    _.remove(u.orders, _.matchesProperty("orderId", orderId));
    await ctx.api.users.editUser(t, { data: {
        _id: u._id,
        orders: u.orders
    }});
}

api.doneOrderPickup = async function(t, { order, pickupId }) {
    let user = await ctx.api.users.getCurrentUserPublic(t, {});
    let orderId = _.get(order, "orderIdentity.orderId");
    let barcode = _.get(order, "orderIdentity.barcode");
    let accessCode = md5(`${orderId}+${barcode}`);

    if (!orderId) throw new Error("Invalid order id");
    if (!pickupId) throw new Error("Invalid pickup id");

    order.accessCode = accessCode;
    order.pickupAddress = {
        id: pickupId
    }
    
    let [ response ] = await topDelivery.changeOrderDeliveryTypeAsync({
        auth: topDeliveryCfg.bodyAuth,
        deliveryTypeParams: _.pick(order, [
            "accessCode",
            "orderIdentity",
            "deliveryType",
            "pickupAddress",
            "clientInfo"
        ])
    });

    if (response.requestResult.status === 1) throw new Error(response.requestResult.message);
    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data: {
            _iduser: user._id,
            status: __.ORDER_STATUS.DONE_PICKUP,
            orderId,
            _dt: new Date()
        }})
    ]);
}

api.doneOrder = async function(t, { order }) {
    let user = await ctx.api.users.getCurrentUserPublic(t, {});
    let deliveryDate = _.get(order, "desiredDateDelivery.date");
    let orderId = _.get(order, "orderIdentity.orderId");
    let barcode = _.get(order, "orderIdentity.barcode");
    let accessCode = md5(`${orderId}+${barcode}`);

    if (!orderId) throw new Error("Invalid order id");
    if (!deliveryDate) throw new Error("Delivery date is required for complete order");

    order.accessCode = accessCode;
    order.workStatus.id = 2;
    order.workStatus.name = "В работе";
    order.desireDateDelivery = order.desiredDateDelivery;
    order.clientAddress = order.deliveryAddress.inCityAddress;

    let [ response ] = await topDelivery.editOrdersAsync({
        auth: topDeliveryCfg.bodyAuth,
        editOrderParams: _.pick(order, [
            "accessCode",
            "orderIdentity",
            "workStatus",
            "desireDateDelivery",
            "clientInfo",
            "clientAddress"
        ])
    });

    if (response.requestResult.status === 1) throw new Error(response.requestResult.message);
    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data: {
            _iduser: user._id,
            status: __.ORDER_STATUS.DONE,
            orderId,
            _dt: new Date()
        }})
    ]);
}

api.denyOrder = async function(t, { order }) {
    let user = await ctx.api.users.getCurrentUserPublic(t, {});
    let orderId = _.get(order, "orderIdentity.orderId");
    let barcode = _.get(order, "orderIdentity.barcode");
    let accessCode = md5(`${orderId}+${barcode}`);
    let denyId = _.get(order, "denyParams.reason.id");

    if (!orderId) throw new Error("Invalid order id");
    if (!( denyId )) throw new Error("Deny reason is required");

    order.accessCode = accessCode;
    order.workStatus.id = 5;
    order.workStatus.name = "отказ";
    order.denyParams.type = "CALL"
    order.denyParams.reason = {
        id: denyId,
        name: {
            1: "Нарушен срок доставки",
            2: "Нет денег в наличии",
            3: "Передумал приобретать",
            4: "Приобрел в другом магазине",
            5: "Не заказывали",
            6: "Не дозвонились/истек срок хранения",
            7: "Другое",
            8: "Размер не соответствует заявленному",
            9: "Товар выглядит иначе, чем на сайте",
            10: "Не устраивает качество",
            11: "Доставлен другой товар"
        }[denyId]
    };

    let [ response] = await topDelivery.setOrdersFinalStatusAsync({
        auth: topDeliveryCfg.bodyAuth,
        finalStatusParams: _.pick(order, [
            "accessCode",
            "orderIdentity",
            "denyParams",
            "workStatus"
        ])
    });

    if (response.requestResult.status === 1) throw new Error(response.requestResult.message);

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data: {
            _iduser: user._id,
            status: __.ORDER_STATUS.DENY,
            orderId,
            _dt: new Date()
        }})
    ]);
}

api.underCall = async function(t, { order }) {
    if (!( order )) throw new Error("Order is required");

    let user = await ctx.api.users.getCurrentUserPublic(t, {});
    let orderId = _.get(order, "orderIdentity.orderId");
    let barcode = _.get(order, "orderIdentity.barcode");
    let accessCode = md5(`${orderId}+${barcode}`);

    if (!orderId) throw new Error("Invalid order id");

    order.accessCode = accessCode;
    order.event = {
        eventType: {
            id: 20,
            name: "edit_by_cc"
        },
        comment: "Недоступен"
    }
    let [ response] = await topDelivery.addOrderEventAsync({
        auth: topDeliveryCfg.bodyAuth,
        orderEvent: _.pick(order, [
            "accessCode",
            "orderIdentity",
            "event"
        ])
    });

    if (response.requestResult.status === 1) throw new Error(response.requestResult.message);

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data: {
            _iduser: user._id,
            status: __.ORDER_STATUS.UNDER_CALL,
            orderId,
            _dt: new Date()
        }})
    ]);
}

api.replaceCallDate = async function(t, { order, replaceDate }) {
    if (!(
        order &&
        replaceDate
    )) throw new Error("Replace date is required");

    let user = await ctx.api.users.getCurrentUserPublic(t, {});
    let orderId = _.get(order, "orderIdentity.orderId");
    let barcode = _.get(order, "orderIdentity.barcode");
    let accessCode = md5(`${orderId}+${barcode}`);

    if (!orderId) throw new Error("Invalid order id");
    if (!replaceDate) throw new Error("Replace date is required");

    order.accessCode = accessCode;
    order.event = {
        eventType: {
            id: 20,
            name: "edit_by_cc"
        },
        comment: `Просит перезвонить позднее %${moment(replaceDate).format("DD.MM.YYYY")}%`
    }
    let [ response] = await topDelivery.addOrderEventAsync({
        auth: topDeliveryCfg.bodyAuth,
        orderEvent: _.pick(order, [
            "accessCode",
            "orderIdentity",
            "event"
        ])
    });

    if (response.requestResult.status === 1) throw new Error(response.requestResult.message);

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data: {
            _iduser: user._id,
            status: __.ORDER_STATUS.REPLACE_DATE,
            orderId,
            _dt: new Date(),
            _dtnextCall: replaceDate
        }})
    ]);
}

api.skipOrder = async function(t, { order }) {
    if (!order) throw new Error("Order not found!");
    
    let user = await ctx.api.users.getCurrentUserPublic(t, {});
    let orderId = _.get(order, "orderIdentity.orderId");

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data: {
            _iduser: user._id,
            status: __.ORDER_STATUS.SKIP,
            orderId,
            _dt: new Date()
        }})
    ]);
}

let ORDERS_IN_OPERATORS = {};
// scheduler function
api.startCallByOrder =  async function(t, p) {
    if (!ctx.cfg.ami.maxQueue) return;

    let orders = await this.getOrders(t, {});
    let listenersCount = await ctx.api.socket.getListenersCount();
    let io = await ctx.api.socket.getIo();
    let serverIo = await ctx.api.socket.getServerIo();
    let currentDate = new Date();
    let idOrders = _.map(orders.list, "orderIdentity.orderId");
    let asteriskIsOn = await ctx.api.asterisk.__isOn(t, {});
    let newOrders = [];
    let oldOrders = [];
    let oldOrdersMap = await api.getStats(t, {
        aggregate: [
            { $match: { orderId: { $in: idOrders }}},
            { $sort: { _dt: -1 }},
            { $group: {
                _id: "$orderId",
                _dt: { $first: "$_dt" },
                _dtnextCall: { $first: "$_dtnextCall" },
                status: { $first: "$status" }
            }}
        ]
    });
    
    oldOrdersMap = _.keyBy(oldOrdersMap.list, "_id");

    _.each(orders.list, order => {
        let phone = _.get(order, "clientInfo.phone");
        let orderId = _.get(order, "orderIdentity.orderId");
        let region = _.get(order, "deliveryAddress.region");
        let timeCall = callTimes[region] || callTimes.default;
        let allowedTimeToCall = moment(currentDate).isBetween(timeCall.from, timeCall.to);
        let isNew = !oldOrdersMap[orderId];
        let blackPhone = false;

        _.each(ctx.cfg.ami.blackList, black => {
            let regex = new RegExp(black);
            if (regex.test(phone)) {
                blackPhone = true;
                return false;
            }
        });

        if (ctx.cfg.ami.sandbox) {
            phone = ctx.cfg.ami.phone;
            allowedTimeToCall = true;
            blackPhone = false;
        }

        let weCanCall = (
            allowedTimeToCall &&
            !ORDERS_IN_OPERATORS[orderId] &&
            !callQueue.tasks[orderId] &&
            !blackPhone
        )

        if (!weCanCall) return;

        if (isNew) {
            newOrders.push(order);
            return;
        }

        let stat = oldOrdersMap[orderId];
        order.timestamp = moment(stat._dt).valueOf();
        if (stat.status === __.ORDER_STATUS.UNDER_CALL) oldOrders.push(order);
        if (
            stat.status === __.ORDER_STATUS.REPLACE_DATE &&
            moment().isAfter(stat._dtnextCall)
        ) oldOrders.push(order)
    });

    oldOrders = _.sortBy(oldOrders, "timestamp");
    
    console.log(`
        log
        -- queue: ${_.keys(callQueue.tasks).length}
        -- listeners: ${listenersCount} 
        -- in queue: ${_.keys(callQueue.tasks)}
        -- new: ${newOrders.length}
        -- old: ${oldOrders.length}
        -- isON: ${asteriskIsOn}
    `);

    for (let order of newOrders.length ? newOrders : oldOrders) {
        if (listenersCount === 0) return;
        if (_.keys(callQueue.tasks).length >= (listenersCount + 1)) return;

        let phone = _.get(order, "clientInfo.phone");
        let orderId = _.get(order, "orderIdentity.orderId");
        
        callQueue.tasks[orderId] = 1;
        callQueue.push({
            name: orderId,
            fn: async () => {
                let asteriskIsOn = await ctx.api.asterisk.__isOn(t, {});
                if (!asteriskIsOn) return;

                let call = await ctx.api.asterisk.__call(t, { phone });
                console.log(`end call --- ` + call.status);

                if (call.status === __.CALL_STATUS.UNNAVAILABLE) {
                    await ctx.api.order.underCall(t, { order });
                    return;
                }
                
                if (call.status === __.CALL_STATUS.DONE) {
                    let user = await ctx.api.users.getUsers(t, {
                        query: { login: call.exten }
                    });
                    user = user.list[0];
                    if (!user) throw new Error("User not found. Exten: " + call.exten);
                    
                    ORDERS_IN_OPERATORS[orderId] = 1;
                    serverIo.once(`${user._id}-${orderId}`, () => {
                        
                        // avoid add order to queue twice
                        setTimeout(() => {
                            delete ORDERS_IN_OPERATORS[orderId];
                        }, 10000);
                    });
                    io.emit(user._id, {
                        orderId
                    });
                    return;
                }

                if (call.status === __.CALL_STATUS.CONNECTING_PROBLEM) return;
    
                throw new Error("Invalid call status: " + call.status);
            }
        })
    }
}

// permissions

api[ __.PERMISSION.ORDER.VIEW ] = async function(t, p) {
    await ctx.api.users.getCurrentUserPublic(t, {});
    return true;
}

api[ __.PERMISSION.ORDER.EDIT ] = async function(t, p) {
    await ctx.api.users.getCurrentUserPublic(t, {});
    return true;
}

api[ __.PERMISSION.STATS.VIEW ] = async function(t, p) {
    let u = await ctx.api.users.getCurrentUserPublic(t, {});
    return u.role === __.ROLES.ADMIN;
}