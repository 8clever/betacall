const express = require("express");
const Router = express();

const { getCurrentCalls } = require("./getCurrentCalls");
const { getStatsByRegion } = require("./getStatsByRegion");
const { getStats } = require("./getStats");
const { getStatsByDay } = require("./getStatsByDay");
const { getIndicators } = require("./getIndicators")
const {
    get,
    token,
    setXlsx
} = require("./helpers");

module.exports.reqs = { router: true, globalUse: true };
module.exports.init = async function (...args) {
    const [ ctx ] = args;
    const { router } = ctx;

    router.use(Router);

    get(Router)("/getCurrentCalls", token(), setXlsx("current_calls"), getCurrentCalls(ctx));

    get(Router)("/getStatsByRegion", token(), setXlsx("call_stats_by_region"), getStatsByRegion(ctx));

    get(Router)("/getStats", token(), setXlsx("call_stats"), getStats(ctx));

    get(Router)("/getStatsByDay", token(), setXlsx("call_stats_by_day"), getStatsByDay(ctx));

    get(Router)("/getIndicators", token(), setXlsx("indicators"), getIndicators(ctx));

    return { api: {}};
};