const express = require("express");
const Router = express();
const moment = require("moment");
const parser = require("cookie");
const _ = require("lodash");

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

function xlsx (file_name) {
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

get("/getCurrentCalls", token(), xlsx("current_calls"), async (req, res) => {
    let query = {};

    if (req.query.orderId) query["orderIdentity.orderId"] = req.query.orderId;
    if (req.query.phone) query["clientInfo.phone"] = req.query.phone;

    let orders = await ctx.api.order.getOrders(res.locals.token, { query });
    let data = ["OrderID, Phone, Client, Delivery Type, Full Price"];

    orders.list.forEach(order => {
        let orderId = _.get(order, "orderIdentity.orderId");
        let phone = _.get(order, "clientInfo.phone");
        let client = _.get(order, "clientInfo.fio");
        let deliveryType = _.get(order, "deliveryType");
        let price = _.get(order, "clientFullCost");
        data.push(`${orderId}, ${phone}, ${client}, ${deliveryType}, ${price}`);
    });

    res.send(data.join("\n"));
});