let t = null;
let ctx = null;
const __ = require("../modules/api/__namespace");
const _ = require("lodash");
const moment = require("moment");

module.exports = async (...args) => {
    [ ctx ] = args;
    t = await ctx.api.scheduler._getRobotToken("public", {});

    startTest();



    await updateStats();
    
    
    
    endTest();
}

async function updateStats () {
    console.log("start update stats");

    let orders = require("../public/orders.json");
    let user = await ctx.api.users.getCurrentUserPublic(t, {});

    for (let order of orders) {

        if (
            order.type === "2" || 
            order.type === "3" ||
            order.type === "4" ||
            order.type === "6" 
        ) {
            let orderStat = {
                _iduser: user._id,
                orderId: parseInt(order.order_id),
                _dt: moment(order.updated_at, "YYYY-MM-DD HH:mm:ss").toDate()
            }

            if (order.type === "2") {
                orderStat.status = __.ORDER_STATUS.UNDER_CALL;
            }

            if (order.type === "3") {
                orderStat.status = __.ORDER_STATUS.DONE;
            }

            if (order.type === "4") {
                orderStat.status = __.ORDER_STATUS.DENY;
            }

            if (order.type === "6") {
                orderStat.status = __.ORDER_STATUS.REPLACE_DATE;
                orderStat._dtnextCall = moment(order.callback_date, "YYYY-MM-DD HH:mm:ss").toDate();
            }

            let orderExists = await ctx.api.order.getStats(t, { query: _.pick(orderStat, [ "orderId", "status", "_dt" ]) });
            if (!orderExists.count) {
                await ctx.api.order.addStats(t, { data: orderStat });
            }
        }
    }
}

function startTest () {
    console.log();
    console.log();
    console.log();
    console.log();
    console.log("    --- RUN TEST ---    ")
}

function endTest () {
    console.log();
    console.log();
    console.log();
    console.log();
    console.log("    --- STOP TEST ---    ");
    process.exit();
}
