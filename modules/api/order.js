
let api = {};
let ctx = null;

const __ = require("./__namespace");
const soap = require("soap");
const _ = require("lodash");
const md5 = require("md5");
const COLLECTION = __.ESSENCE;

let topDelivery = null;
let topDeliveryCfg = null;
let __orders = [];
let cols = {};

module.exports.deps = ['mongo', 'obac'];
module.exports.init = async function(...args) {
    [ctx] = args;

    topDeliveryCfg = ctx.cfg.topDelivery;
    topDelivery = await soap.createClientAsync(ctx.cfg.topDelivery.url);
    topDelivery.setSecurity(new soap.BasicAuthSecurity(
        topDeliveryCfg.basicAuth.user,
        topDeliveryCfg.basicAuth.password
    ));
    
    await api._getCallOrders().catch(console.log);

    ctx.api.validate.register(COLLECTION.STATS, {
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
	});

	let db = await ctx.api.mongo.getDb({});
    cols[COLLECTION.STATS] = await db.collection(COLLECTION.STATS);
    
    api.getStats = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.STATS]);
    api.addStats = ctx.api.coreapi.initEditApiFunction({
        collection: cols[COLLECTION.STATS],
        validate: COLLECTION.STATS
    });

    return { api }
}

api._getCallOrders = async function(t, p) {
    let currentDate = new Date();
    let [ orders ] = await topDelivery.getCallOrdersAsync({
        auth: topDeliveryCfg.bodyAuth
    });

    if (ctx.cfg.ami.sandbox && ctx.cfg.ami.phone) {
        _.each(orders.orderInfo, order => {
            order.clientInfo.phone = ctx.cfg.ami.phone;
        });
    }

    let completeOrders = await api.getStats(t, {
        query: {
            $or: [
                { status: { $in: [ "deny", "done" ]} },
                { status: "replace_date", _dtnextCall: { $gte: currentDate }}
            ]
        },
        fields: {
            orderId: 1
        }
    });

    let ordersMap = _.keyBy(completeOrders.list, "orderId");
    _.remove(orders.orderInfo, order => {
        let orderId = _.get(order, "orderIdentity.orderId");
        return ordersMap[orderId];
    });

    __orders = orders.orderInfo;
}

api.getOrders = async function(t, p) {
    await ctx.api.users.getCurrentUserPublic(t, {});
    return __orders.concat([]);
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

    let [ response ] = await topDelivery.editOrdersAsync({
        auth: topDeliveryCfg.bodyAuth,
        editOrderParams: _.pick(order, [
            "accessCode",
            "orderIdentity",
            "workStatus",
            "desireDateDelivery",
            "clientInfo"
        ])
    });

    if (response.requestResult.status === 1) throw new Error(response.requestResult.message);

    await this.unsetMyOrder(t, { orderId });
    await this.addStats(t, { data: {
        _iduser: user._id,
        status: "done",
        orderId,
        _dt: new Date()
    }})
    await this._getCallOrders(t, {});
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
    await this.unsetMyOrder(t, { orderId });

    await this.addStats(t, { data: {
        _iduser: user._id,
        status: "deny",
        orderId,
        _dt: new Date()
    }});
    await this._getCallOrders(t, {});
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
        }
    }
    order.comment = "Причина переноса: не дозвонились (Не берет трубку)";
    let [ response] = await topDelivery.addOrderEventAsync({
        auth: topDeliveryCfg.bodyAuth,
        orderEvent: _.pick(order, [
            "accessCode",
            "orderIdentity",
            "event",
            "comment"
        ])
    });

    if (response.requestResult.status === 1) throw new Error(response.requestResult.message);
    await this.unsetMyOrder(t, { orderId });

    await this.addStats(t, { data: {
        _iduser: user._id,
        status: "replace_date",
        orderId,
        _dt: new Date(),
        _dtnextCall: replaceDate
    }});
    await this._getCallOrders(t, {});
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