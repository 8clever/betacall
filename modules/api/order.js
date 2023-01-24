
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
                _i_operatorTimeUsage: {
                    type: "number"
                },
                _dt: {
                    type: "date",
                    required: true
                },
                _dtnextCall: {
                    type: "date"
                },
                _s_callId: {
                    type: "string",
                    required: true,
                    minLength: 2
                },
                _s_fullName: {
                    type: "string"
                },
                _s_phone: {
                    type: "string"
                },
                _s_region: {
                    type: "string"
                },
                _dtendOfStorage: {
                    type: [ "date", "null" ]
                },
                _s_deliveryType: {
                    type: "string"
                },
                _s_marketName: {
                    type: "string"
                }
			}
		}
    }
    
    ctx.api.validate.register(COLLECTION.STATS, validateStat);
    ctx.api.validate.register(COLLECTION.STATS_ALL, validateStat);
    ctx.api.validate.register(COLLECTION.__JOIN_STATS, validateStat);

	let db = await ctx.api.mongo.getDb({});
    
    cols[COLLECTION.STATS] = await db.collection(COLLECTION.STATS);
    cols[COLLECTION.STATS_ALL] = await db.collection(COLLECTION.STATS_ALL);
    cols[COLLECTION.__JOIN_STATS] = await db.collection(COLLECTION.__JOIN_STATS);

    await ctx.api.mongo.ensureIndex(cols[COLLECTION.STATS], { orderId: 1 });
    await ctx.api.mongo.ensureIndex(cols[COLLECTION.STATS], { status: 1 });
    
    api.getStats = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.STATS]);
    api.getStatsAll = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.STATS_ALL]);
    api.getJoinStats = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.__JOIN_STATS]);

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
            console.log(err);
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
 * p.query
 */
api.prepareJoinStats = async function(t, p) {
    if (!p.query) throw new Error("Query for join stats is required");

    const qf = ctx.api.prefixify.query;
    const query = qf(p.query);

    const [, stats, statsAll] = await Promise.all([
        cols[COLLECTION.__JOIN_STATS].remove(),
        cols[COLLECTION.STATS].find(query).toArray(),
        cols[COLLECTION.STATS_ALL].find(query).toArray()
    ]);

    await Promise.all([
        (async () => {
            if (!stats.length) return;
            await cols[COLLECTION.__JOIN_STATS].insertMany(stats)
        })(),
        (async () => {
            if (!statsAll.length) return;
            await cols[COLLECTION.__JOIN_STATS].insertMany(statsAll)
        })()
    ]);
}

/**
 * used by scheduller each 15 minutes
 */
api._insertNotProcessedOrders = async function(t, p) {
    const user = await ctx.api.users.getCurrentUserPublic(t, {});
    const orderIds = _.map(__orders, "orderIdentity.orderId");
    const searchPrms = [
        t,
        {
            aggregate: [
                { $match: { orderId: { $in: orderIds }}},
                { $group: {
                    _id: "$orderId"
                }}
            ]
        }
    ];
    let [ inProcess, inStats ] = await Promise.all([
        this.getStats(...searchPrms),
        this.getStatsAll(...searchPrms)
    ]);
    inProcess = _.keyBy(inProcess.list, "_id");
    inStats = _.keyBy(inStats.list, "_id");

    for (let order of __orders) {
        const orderId = _.get(order, "orderIdentity.orderId");
        
        if (!inProcess[orderId] && !inStats[orderId]) {
            let data = _.assign({
                _s_callId: "NOT CALLED YET",
                _iduser: user._id,
                status: __.ORDER_STATUS.NOT_PROCESSED
            }, api.getOrderMeta(order));

            await this.addStats(t, { data });
        }
    }
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

    __orders = orders.orderInfo || [];
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
    let order = _.find(__orders, _.matchesProperty("orderIdentity.orderId", Number(orderId)));
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

    for (let { orderId, _s_callId } of u.orders || []) {
        try {
            let order = await this.getOrderByID(t, { orderId });
            orders.push({ 
                info: order, 
                metadata: {
                    callId: _s_callId
                }
            });
        } catch(err) {/** empty */}
    }

    return orders;
}

api.addToMyOrders = async function(t, { orderId, callId }) {
    if (!orderId) throw new Error("Invalid order id");
    orderId = parseFloat(orderId);

    let u = await ctx.api.users.getCurrentUserPublic(t, {});

    u.orders = u.orders || [];
    let orderAlreadyMy = _.find(u.orders, _.matchesProperty("orderId", orderId));
    if (orderAlreadyMy) return;

    u.orders.push({ 
        orderId,
        _s_callId: callId,
        _dt: new Date()
    });

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

/**
 *  @param metadata.callId
 */
api.doneOrderPickup = async function(t, { order, pickupId, metadata }) {
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

    let data = _.assign({
        _s_callId: metadata.callId,
        _iduser: user._id,
        status: __.ORDER_STATUS.DONE_PICKUP
    }, 
        api.getOrderMeta(order),
        api.getProcessedTime(user, orderId)
    );

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data })
    ]);
}

api.doneOrder = async function(t, { order, metadata }) {
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

    const editOrderParams = _.pick(order, [
        "accessCode",
        "orderIdentity",
        "workStatus",
        "desireDateDelivery",
        "clientInfo",
        "clientAddress"
    ]);

    let [ response ] = await topDelivery.editOrdersAsync({
        auth: topDeliveryCfg.bodyAuth,
        editOrderParams
    });

    if (response.requestResult.status === 1) {
        console.dir(editOrderParams, { depth: null });
        throw new Error(response.requestResult.message);
    }

    let data = _.assign({
        _s_callId: metadata.callId,
        _iduser: user._id,
        status: __.ORDER_STATUS.DONE
    }, 
        api.getOrderMeta(order),
        api.getProcessedTime(user, orderId)
    );

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data })
    ]);
}

api.denyOrder = async function(t, { order, metadata }) {
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

    let data = _.assign({
        _s_callId: metadata.callId,
        _iduser: user._id,
        status: __.ORDER_STATUS.DENY
    }, 
        api.getOrderMeta(order),
        api.getProcessedTime(user, orderId)
    );

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data })
    ]);
}

api.underCall = async function(t, { order, metadata }) {
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

    let data = _.assign({
        _s_callId: metadata.callId,
        _iduser: user._id,
        status: __.ORDER_STATUS.UNDER_CALL
    }, 
        api.getOrderMeta(order),
        api.getProcessedTime(user, orderId)
    );

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data })
    ]);
}

api.replaceCallDate = async function(t, { order, replaceDate, metadata }) {
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

    let data = _.assign({
        _s_callId: metadata.callId,
        _iduser: user._id,
        _dtnextCall: replaceDate,
        status: __.ORDER_STATUS.REPLACE_DATE
    }, 
        api.getOrderMeta(order),
        api.getProcessedTime(user, orderId)
    );
    
    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data })
    ]);
}

api.skipOrder = async function(t, { order, metadata }) {
    if (!order) throw new Error("Order not found!");
    
    let user = await ctx.api.users.getCurrentUserPublic(t, {});
    let orderId = _.get(order, "orderIdentity.orderId");
    let data = _.assign({
        _s_callId: metadata.callId,
        _iduser: user._id,
        status: __.ORDER_STATUS.SKIP
    }, 
        api.getOrderMeta(order),
        api.getProcessedTime(user, orderId)
    );

    await Promise.all([
        this.unsetMyOrder(t, { orderId }),
        this.addStats(t, { data })
    ]);
}

let ORDERS_IN_OPERATORS = {};
// scheduler function
api.startCallByOrder =  async function(t, p) {
    if (!ctx.cfg.ami.maxQueue) return;

    const [
        orders,
        listenersCount,
        io,
        serverIo,
        asteriskIsOn,
        settings
    ] = await Promise.all([
        this.getOrders(t, {}),
        ctx.api.socket.getListenersCount(),
        ctx.api.socket.getIo(),
        ctx.api.socket.getServerIo(),
        ctx.api.asterisk.__isOn(t, {}),
        ctx.api.settings.getSettings(t, {})
    ]);
    const currentDate = new Date();
    const idOrders = _.map(orders.list, "orderIdentity.orderId");
    const newOrders = [];
    let oldOrders = [];
    let [
        oldOrdersMap,
        ordersRoundMap
    ] = await Promise.all([
        api.getStats(t, {
            aggregate: [
                { $match: { 
                    orderId: { $in: idOrders },
                    status: { $ne: __.ORDER_STATUS.NOT_PROCESSED }
                }},
                { $sort: { _dt: -1 }},
                { $group: {
                    _id: "$orderId",
                    _dt: { $first: "$_dt" },
                    _dtnextCall: { $first: "$_dtnextCall" },
                    status: { $first: "$status" }
                }}
            ]
        }),
        api.getStats(t, {
            aggregate: [
                {
                    $match: {
                        _dt: {
                            $gte: moment().startOf("day").toDate(),
                            $lte: moment().endOf("day").toDate()
                        },
                        status: {
                            $ne: __.ORDER_STATUS.NOT_PROCESSED
                        }
                    }
                },
                {
                    $group: {
                        _id: "$orderId",
                        count: { $sum: 1 }
                    }
                }
            ]
        })
    ]);
    
    oldOrdersMap = _.keyBy(oldOrdersMap.list, "_id");
    ordersRoundMap = _.keyBy(ordersRoundMap.list, "_id");

    _.each(orders.list, order => {
        let phone = _.get(order, "clientInfo.phone");
        let marketName = _.get(order, "orderUrl", "");
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

        _.each(ctx.cfg.ami.blackMarkets, black => {
            let regex = new RegExp(black);
            if (regex.test(marketName)) {
                blackPhone = true;
                return false;
            } 
        });

        _.each(ctx.cfg.ami.blackRegions, black => {
            let regex = new RegExp(black);
            if (regex.test(region)) {
                blackPhone = true;
                return false;
            } 
        });

        if (ctx.cfg.ami.sandbox) {
            order.clientInfo.phone = ctx.cfg.ami.phone;
            allowedTimeToCall = true;
            blackPhone = false;
        }

        let weCanCall = (
            allowedTimeToCall &&
            !ORDERS_IN_OPERATORS[orderId] &&
            !callQueue.tasks[orderId] &&
            !blackPhone &&
            order.deliveryType !== __.DELIVERY_TYPE.PICKUP
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
        -- in operators: ${_.keys(ORDERS_IN_OPERATORS)}
        -- new: ${newOrders.length}
        -- old: ${oldOrders.length}
        -- isON: ${asteriskIsOn}
    `);

    for (let order of newOrders.length ? newOrders : oldOrders) {
        if (listenersCount === 0) return;
        if (_.keys(callQueue.tasks).length >= (listenersCount + ctx.cfg.ami.addQueue)) return;
        
        let phone = _.get(order, "clientInfo.phone");
        let orderId = _.get(order, "orderIdentity.orderId");
        
        callQueue.tasks[orderId] = 1;
        callQueue.push({
            name: orderId,
            fn: async () => {

                const n = _.get(ordersRoundMap, `${orderId}.count`, 0);
                const gateawayName = n === 1 ? "mango1" : "default";
                console.log("gateaway", gateawayName, n);
                
                /** TODO connect textToSpeech service */
                let texts = [];
                let robotDeliveryDate = null;

                if (ctx.cfg.mqtt.textToSpeech) {
                    const intervals = await ctx.api.order.getNearDeliveryDatesIntervals(t, { orderId });
                    const allowedInterval = intervals.find(i => i.quotas.available);
                    const translit = settings.markets.find(m => m.key === order.orderUrl);
                    const marketName = translit ? translit.value : order.orderUrl;
                    const allowedMarket = !ctx.cfg.robot.blockMarkets.includes(order.orderUrl);

                    if (allowedInterval && allowedMarket) {
                        robotDeliveryDate = moment(allowedInterval.date).format("DD.MM.YYYY");
                        texts = [
                            `Вам пришла посылка из интернет магазина ${marketName}. Стоимостью ${order.clientFullCost}`,
                            `Адрес доставки: Город ${order.deliveryAddress.city}, ${order.deliveryAddress.inCityAddress.address}.`,
                            `Мы можем доставить посылку ${robotDeliveryDate} года`
                        ]  
                    }
                }

                let call = await ctx.api.asterisk.__call(t, { 
                    phone, 
                    gateawayName, 
                    texts,
                    vars: {
                        orderId,
                        robotDeliveryDate
                    }
                });
                if (call.status === __.CALL_STATUS.ASTERISK_BUSY) return;

                console.log(`end call --- ` + call.status);

                if (call.status === __.CALL_STATUS.UNNAVAILABLE) {
                    await ctx.api.order.underCall(t, { 
                        order,
                        metadata: {
                            callId: call.id
                        }
                    });
                    return;
                }

                if (call.status === __.CALL_STATUS.RECALL_LATER) {
                    const replaceDate = moment().add(1, "day").toDate();
                    await ctx.api.order.replaceCallDate(t, { order, replaceDate, metadata: {
                        orderId,
                        callId: call.id
                    }})
                    return;
                }

                if (call.status === __.CALL_STATUS.DONE_ORDER) {
                    const intervals = [
                        { from: "10:00:00", to: "18:00:00" },
                        { from: "10:00:00", to: "22:00:00" }
                    ]
                    _.set(order, "desiredDateDelivery.date", robotDeliveryDate);

                    for (const i of intervals) {
                        _.set(order, "desiredDateDelivery.timeInterval.bTime", i.from);
                        _.set(order, "desiredDateDelivery.timeInterval.eTime", i.to);

                        try {
                            await ctx.api.order.doneOrder(t, { order, metadata: {
                                orderId,
                                callId: call.id
                            }})
                            break;                            
                        } catch {
                            /** EMPTY */
                        }
                    }

                    return;
                }
                
                if (call.status === __.CALL_STATUS.DONE) {
                    const user = await ctx.api.users.getUserByLogin(t, { 
                        login: call.exten
                    });
                    if (!user) throw new Error("User not found. Exten: " + call.exten);
                    
                    ORDERS_IN_OPERATORS[orderId] = 1;
                    serverIo.once(`${user._id}-${orderId}`, () => {
                        
                        // avoid add order to queue twice
                        setTimeout(() => {
                            delete ORDERS_IN_OPERATORS[orderId];
                        }, 10000);
                    });
                    io.emit(user._id, {
                        orderId,
                        callId: call.id
                    });
                    return;
                }

                if (call.status === __.CALL_STATUS.MANUAL_RELEASE) return;
                if (call.status === __.CALL_STATUS.CONNECTING_PROBLEM) return;
    
                throw new Error("Invalid call status: " + call.status);
            }
        })
    }
}

api.getOrderMeta = order => {
    if (!order) throw new Error("Order is required");

    return {
        _s_fullName: _.get(order, "clientInfo.fio", ""),
        _s_phone: _.get(order, "clientInfo.phone", ""),
        _s_region: _.get(order, "deliveryAddress.region", ""),
        _dtendOfStorage: _.get(order, "endOfStorageDate", null),
        _dt: new Date(),
        orderId: _.get(order, "orderIdentity.orderId"),
        _s_marketName: _.get(order, "orderUrl", ""),
        _s_deliveryType: _.get(order, "deliveryType", "")
    };
}

/**
 * @param user - Userr
 * @param orderId - ID of order
 */
api.getProcessedTime = (user, orderId) => {
    if (!user) throw new Error("User is required");
    
    const order = _.find(user.orders, _.matches({ orderId }));
    if (!(order && order._dt)) {
        return {};
    }

    return {
        _i_operatorTimeUsage: moment().diff(order._dt)
    }
}


/**
 * @typedef TimeInterval
 * @type {object}
 * @property {string} bTime - HH:mm:ss time from
 * @property {string} eTime - HH:mm:ss time to
 * 
 * @typedef Quota
 * @type {object}
 * @property {string} date
 * @property {number} available
 * @property {TimeInterval[]} timeInterval
 * 
 * @param {string} t 
 * @param {object} param1
 * @param {number} param1.orderId
 * @returns {Promise<Quota[]>}
*/
api.getNearDeliveryDatesIntervals = async (t, { orderId }) => {
    const [ response ] = await topDelivery.getNearDeliveryDatesIntervalsAsync({
        auth: ctx.cfg.topDelivery.bodyAuth,
        orderIdentity: {
            orderId
        }
    });

    /**
     * @type {Quota[]}
     */
    const dateTimeIntervals = response.dateTimeIntervals || [];
    return dateTimeIntervals;
}

api.getHistoryByOrderId = async (t, { orderId }) => {
    const [ response ] = await topDelivery.getOrderEventsAsync({
        auth: ctx.cfg.topDelivery.bodyAuth,
        order: {
            orderId
        }
    });
    return response.orderEventsInfo;
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