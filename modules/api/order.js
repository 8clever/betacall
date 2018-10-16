
let api = {};
let ctx = null;
let cols = {};

const __ = require("./__namespace");
const _ = require("lodash");
const COLLECTION = __.ESSENCE;
const soap = require("soap");

module.exports.deps = ['mongo', 'obac'];
module.exports.init = async function(...args) {
    [ctx] = args;

    ctx.api.validate.register(COLLECTION.ORDER, {
		$set: {
			properties: {
				_id: {
					type: "mongoId"
				},
				_iduser: {
					type: "mongoId"
                },
                _s_orderid: {
                    type: "string",
                    required: true
                },
                _dt: {
                    type: "date",
                    required: true
                },
                _dtupdate: {
                    type: "date"
                },
                status: {
                    type: "string",
                    required: true,
                    enum: _.values(__.ORDER_STATUS)
                },
                info: {
                    type: "object",
                    required: true
                }
			}
		}
	});

    let db = await ctx.api.mongo.getDb({});
	cols[COLLECTION.ORDER] = await db.collection(COLLECTION.ORDER);

    api.getOrders = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.ORDER]);
    api.editOrder = ctx.api.coreapi.initEditApiFunction({
        collection: cols[COLLECTION.ORDER],
        permission: __.PERMISSION.ORDER.EDIT,
        validate: COLLECTION.ORDER
    });

    return { api }
}

/**
 * Only scheduler function
 */
api.importFromMySql = async function(t, p) {
    let connection = await ctx.api.mysql.getConnection(t, {});
    let orders = await ctx.api.order.getOrders(t, { fields: { _s_orderid: 1 }});
    let sqlQuery = `SELECT * FROM orders `
    const TYPE_MAP = {
        0: __.ORDER_STATUS.NEW,
        1: __.ORDER_STATUS.IN_PROGRESS,
        2: __.ORDER_STATUS.UNDER_CALL,
        3: __.ORDER_STATUS.DONE,
        4: __.ORDER_STATUS.DENY,
        5: __.ORDER_STATUS.NEW
    }

    if (orders.count) {
        sqlQuery += ` WHERE order_id NOT IN (${_.map(orders.list, "_s_orderid").join(",")})`;
    }

    let results = await new Promise((resolve, reject) => {
        connection.query(sqlQuery, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });

    await Promise.all(_.map(results, _order => {
        return (async () => {
            let order = {
                _s_orderid: _order.order_id,
                _dt: _order.created_at,
                _dtupdate: _order.updated_at,
                status: TYPE_MAP[_order.type],
                info: JSON.parse(_order.order_data)
            };
    
            await ctx.api.order.editOrder(t, {
                data: order
            });
        })();
    }));
}

api.importFromTopDelivery = async function(t, p) {
    // TODO Complete integration with top delivery
    let u = await ctx.api.users.getCurrentUserPublic(t, {});
    let client = await soap.createClientAsync(ctx.cfg.topDelivery.url);
    client.setSecurity(new soap.BasicAuthSecurity(
        ctx.cfg.topDelivery.login, 
        ctx.cfg.topDelivery.password
    ));
    let orders = await client.getCallOrdersAsync({
        auth: {
            login: ctx.cfg.topDelivery.login,
            password: ctx.cfg.topDelivery.password
        }
    });
}

api.getMyOrder = async function(t, notRequired) {
    let u = await ctx.api.users.getCurrentUserPublic(t, {});

    let inProgress = await ctx.api.order.getOrders(t, {
        query: {
            _iduser: u._id,
            status: __.ORDER_STATUS.IN_PROGRESS
        },
        sort: { _dt: -1 }
    });

    if (inProgress.count) return inProgress.list[0];

    let freeOrder = await ctx.api.order.getOrders(t, {
        query: {
            status: __.ORDER_STATUS.NEW,
            _iduser: { $exists: 0 }
        },
        sort: {
            _dt: -1
        }
    });

    if (freeOrder.count) {
        let order = freeOrder.list[0];
        order.status = __.ORDER_STATUS.IN_PROGRESS
        order._iduser = u._id;
        await ctx.api.order.editOrder(t, {
            data: _.pick(order, [ "_id", "status", "_iduser" ])
        });
        return order;
    }

    return null;
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