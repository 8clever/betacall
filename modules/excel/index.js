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
            endOfStorageDate = moment(endOfStorageDate.v).format("YYYY-MM-DD");
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