const express = require("express");
const Router = express();
const moment = require("moment");
const parser = require("cookie");
const _ = require("lodash");
const xlsx = require("node-xlsx");

let ctx = null

module.exports.reqs = { router: true, globalUse: true };
module.exports.init = async function (...args) {
    [ ctx ] = args;
    let { router } = ctx;

    router.use(Router);
    return { api: {}};
};

function generateAsyncMiddles (mddles) {
    return mddles.map(mid => {
        return async (req, res, next) => {
            try {
                let result = await mid(req, res);
                if (result === "next") next();
            } catch (err) {
                next(err);
            }
        }
    });
}

function get (path, ...middlewares) {
    Router.get(path, ...generateAsyncMiddles(middlewares));
}

function generateName (name) {
    let time = moment();
    return `${name}_${time.format("YYYY_MM_DD_HH_mm")}.xlsx`
}

function setXlsx (file_name) {
    return async (req, res) => {
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.set('Content-Disposition', `attachment; filename="${generateName(file_name)}"`);
        return "next";
    }
}

function token () {
    return async (req, res) => {
        let cookies = req.headers.cookie;
        if (!cookies) return null;
        cookies = parser.parse(cookies);
        res.locals.token = cookies.token;
        return "next";
    }
}

get("/getCurrentCalls", token(), setXlsx("current_calls"), async (req, res) => {
    const query = {};

    if (req.query.orderId) query["orderIdentity.orderId"] = req.query.orderId;
    if (req.query.phone) query["clientInfo.phone"] = req.query.phone;

    const orders = await ctx.api.order.getOrders(res.locals.token, { query });
    let data = [["OrderID", "Phone", "Client", "End of Storage Date", "Full Price"]];

    orders.list.forEach(order => {
        const orderId = _.get(order, "orderIdentity.orderId");
        const phone = _.get(order, "clientInfo.phone");
        const client = _.get(order, "clientInfo.fio");
        const price = _.get(order, "clientFullCost");
        let endOfStorageDate = _.get(order, "endOfStorageDate");
        if (endOfStorageDate) {
            endOfStorageDate = moment(endOfStorageDate.v || endOfStorageDate).format("YYYY-MM-DD");
        }

        data.push([
            orderId,
            phone,
            client,
            endOfStorageDate,
            price   
        ]);
    });

    let buff = xlsx.build([
        { name: "Current Orderds", data }
    ]);

    res.send(buff);
});

get("/getStats", token(), setXlsx("call_stats"), async (req, res) => {
    const query = {};
    const query2 = {};
    const filter = req.query;
    const ddFormat = "DD-MM-YYYY";

    // query 1
    if (filter.user) {
        query._iduser = filter.user
    }

    if (filter.from) {
        query._dt = query._dt || {};
        query._dt.$gte = moment(filter.from, ddFormat).startOf("day").toDate()
    }

    if (filter.to) {
        query._dt = query._dt || {};
        query._dt.$lte = moment(filter.to, ddFormat).endOf("day").toDate()
    }

    if (filter.orderId) {
        query.orderId = parseInt(filter.orderId);
    }


    if (filter.marketName) {
        query._s_marketName = { $regex: filter.marketName, $options: "gmi" }
    }

    // query 2
    if (filter.status) {
        query2.status = filter.status;
    }

    await ctx.api.order.prepareJoinStats(res.locals.token, { query });

    const stats = await ctx.api.order.getJoinStats(res.locals.token, {
        aggregate: [
            { $match: query },
            { $group: {
                _id: "$orderId",
                status: { $last: "$status" },
                _dtendOfStorage: { $last: "$_dtendOfStorage" },
                _s_fullName: { $last: "$_s_fullName" },
                _s_phone: { $last: "$_s_phone" },
                _s_region: { $last: "$_s_region" },
                _s_marketName: { $last: "$_s_marketName" }
            }},
            { $match: query2 },
            { $addFields: {
                orderId: "$_id"
            }}
        ],
        sort: {
            _dt: -1
        }
    });

    const rounds = await ctx.api.order.getJoinStats(res.locals.token, {
        aggregate: [
            { $match: {
                orderId: { $in: _.map(stats.list, "_id") }
            }},
            {
                $group: {
                    _id: "$orderId",
                    rounds: {
                        $push: {
                            status: "$status",
                            _dt: "$_dt"
                        }
                    },
                    _dtfirst: { $first: "$_dt" },
                    _dtlast: { $last: "$_dt" }
                }
            }
        ],
        sort: {
            _dt: -1
        }
    });
    const roundsMap = rounds.list.reduce((memo, round) => {
        memo[round._id] = round;
        return memo;
    }, {});

    let roundCount = 0;
    let header = [ "OrderID", "Full Name", "First Date", "Last Date", "End Of Storage", "Region", "Market Name" ];
    let defaultHeaderLength = header.length;
    let data = [header];

    _.each(stats.list, stat => {
        let map = roundsMap[stat._id] || { rounds: []};
        stat.rounds = map.rounds;
        stat._dtfirst = map._dtfirst;
        stat._dtlast = map._dtlast;

        let row = [
            stat._id,
            stat._s_fullName,
            moment(stat._dtfirst).format(ddFormat),
            moment(stat._dtlast).format(ddFormat),
            moment(stat._dtendOfStorage).format(ddFormat),
            stat._s_region,
            stat._s_marketName
        ]

        if (stat.rounds.length > roundCount) roundCount = stat.rounds.length;
        _.each(stat.rounds, round => {
            row.push(round.status);
        });
        data.push(row);
    });

    while (roundCount > 0) {
        header.push(`round ${ header.length - defaultHeaderLength + 1 }`);
        --roundCount;
    }

    header.push("last status");
    _.each(data, (row, idx) => {
        if (idx === 0) return;

        const lastStatus = row[row.length - 1];

        while (row.length < header.length - 1) {
            row.push("");
        }

        row.push(lastStatus);
    });

    const buff = xlsx.build([
        { name: "Stats", data }
    ])
    res.send(buff);
});