let t = null;
let ctx = null;
const __ = require("../modules/api/__namespace");

module.exports = async (...args) => {
    [ ctx ] = args;
    t = await ctx.api.scheduler._getRobotToken("public", {});

    startTest();
    await doneOrderPickup();
    endTest();
}

async function doneOrderPickup () {
    console.log("check doneOrderPickup");

    let orders = await ctx.api.order.getOrders(t, {});
    let order = orders.list[orders.list.length - 1];
    order.deliveryType = __.DELIVERY_TYPE.PICKUP;

    await ctx.api.order.doneOrderPickup(t, { order, pickupId: 100 });
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
