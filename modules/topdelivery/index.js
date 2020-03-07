const _ = require("lodash");
const ddFormat = "YYYY-MM-DD";
const moment = require("moment");
const path = require("path");

let ctx;

module.exports.reqs = { router: true, globalUse: true };
module.exports.init = async function (...args) {
    [ ctx ] = args;

    ctx.router.get("/getOrders", checkApiKey(), asyncRouter(async (req, res) => {
        let { dtstart, dtend, orderid } = req.query;
        let mysql = await ctx.api.mysql.getConnection();
        let baseUrl = await ctx.api.coreapi.getBaseUrl();
        let query = {
            _s_callId: { $exists: 1 }
        };

        if (orderid) {
            query.orderId = parseInt(orderid);
        }

        if (dtstart) {
            query._dt = query._dt || {};
            query._dt.$gte = moment(dtstart, ddFormat).startOf("day").toDate();
        }

        if (dtend) {
            query._dt = query._dt || {};
            query._dt.$lte = moment(dtend, ddFormat).endOf("day").toDate();
        }

        let t = await ctx.api.scheduler._getRobotToken();
        let orders = await ctx.api.order.getStatsAll(t, { 
            limit: 1000,
            sort: {
                _dt: -1
            },
            query 
        });
        let callIds = _.map(orders.list, "_s_callId");
        let stats = await new Promise((resolve, reject) => {
            mysql.query([
                "select *",
                "from cdr",
                `where uniqueid in ('${callIds.join(`', '`)}');`
            ].join(" "), (err, response) => {
                mysql.release();

                if (err) return reject(err);
                resolve(response);
            }) 
        });
        stats = _.keyBy(stats, "uniqueid");
        
        let data = _.map(orders.list, order => {
            let asteriskData = stats[order._s_callId];
            if (!asteriskData) return;

            return {
                _dtcallStart: asteriskData.start,
                _dtcallEnd: asteriskData.end,
                _dttalkStart: asteriskData.answer,
                _id: order._id,
                _s_phone: asteriskData.src || asteriskData.dst,
                _s_urlTalkRecord: asteriskData.filename ? `${baseUrl}/topdelivery/file/${asteriskData.id}` : null,
                _i_orderId: order.orderId
            }
        });

        ctx.router.get("/file/:id", checkApiKey(), asyncRouter(async (req, res) => {
            let { id } = req.params;
            if (!id) throw CustomError("Invalid id of asterisk stats", 503);

            let mysql = await ctx.api.mysql.getConnection();
            let stat = await new Promise((resolve, reject) => {
                mysql.query([
                    "select *",
                    "from cdr",
                    `where id = ${id}`
                ].join(" "), (err, response) => {
                    mysql.release();

                    if (err) return reject(err);
                    resolve(response);
                }) 
            });
            
            stat = stat[0];
            if (!(stat && stat.filename)) throw new CustomError("Asterisk stat file not found", 404);

            let filePath = path.join(ctx.cfg.ami.dirRecords, stat.filename);
            res.sendFile(filePath);
        }));

        data = _.compact(data);
        res.json(data);
    }));

    return { api: {}};
};

class CustomError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

function checkApiKey () {
    return asyncRouter(async (req, res) => {
        let { apikey } = req.query;

        if (!(apikey && _.includes(ctx.cfg.topdeliveryApi.apiKeys, apikey))) {
            throw new CustomError("Invalid api key", 403);
        }
    
        return "next";
    })
}

function asyncRouter (fn) {
    return function(req, res, next) {
        fn(req, res).then(res => {
            if (res === "next") next();
        }).catch(err => {
            res.status(err.status || 503).json({ error: err.message });
        });
    }
}
