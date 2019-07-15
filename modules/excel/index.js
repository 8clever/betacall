const express = require("express");
const Router = express();
const moment = require("moment");
const parser = require("cookie");
const _ = require("lodash");
const xlsx = require("node-xlsx");
const ddFormat = "DD-MM-YYYY";
const { ORDER_STATUS } = require("../api/__namespace");
const __ = {
    ORDER_STATUS: _.omit(ORDER_STATUS, ["SKIP"])
}
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

function getQuery (filter) {
    const query = {};
    const query2 = {};

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

    query.$and = query.$and || [];
    query.$and.push({
        _s_phone: {
            $nin: _.map(ctx.cfg.ami.blackList, black => {
                return { $regex: black, $options: "gmi" };
            })
        }
    });

    return {
        query,
        query2
    }
}

async function getStaysByDay (token, filter) {
    const { query, query2 } = getQuery(filter);

    await ctx.api.order.prepareJoinStats(token, { query });

    const stats = await ctx.api.order.getJoinStats(token, {
        aggregate: [
            { $match: query },
            { $match: query2 },
            { $group: Object.assign({
                _id: {
                    date: {
                        $dateToString: {
                            format: "%d-%m-%Y",
                            date: "$_dt"
                        }
                    },
                    region: "$_s_region"
                },
                rounds: {
                    $push: {
                        _dt: "$_dt",
                        status: "$status",
                        orderId: "$orderId"
                    }
                },
                total: {
                    $sum: 1
                }
            }, _.reduce(__.ORDER_STATUS, (memo, status) => {
                memo[status] = {
                    $sum: {
                        $cond: {
                            if: { $eq: [ "$status", status ]},
                            then: 1,
                            else: 0
                        }
                    }
                }
                return memo;
            }, {}))}
        ],
        sort: {
            _dt: -1
        }
    });

    const ttStats = await ctx.api.order.getJoinStats(token, {
        aggregate: [
            { $match: query },
            { $match: query2 },
            { $group: Object.assign({
                _id: {
                    date: {
                        $dateToString: {
                            format: "%d-%m-%Y",
                            date: "$_dt"
                        }
                    },
                    region: "Итого по регионам"
                },
                rounds: {
                    $push: {
                        _dt: "$_dt",
                        status: "$status",
                        orderId: "$orderId"
                    }
                },
                total: {
                    $sum: 1
                }
            }, _.reduce(__.ORDER_STATUS, (memo, status) => {
                memo[status] = {
                    $sum: {
                        $cond: {
                            if: { $eq: [ "$status", status ]},
                            then: 1,
                            else: 0
                        }
                    }
                }
                return memo;
            }, {}))}
        ],
        sort: {
            _dt: -1
        }
    });

    stats.list.push(...ttStats.list);

    return {
        stats
    };
}

async function getStatsWithRounds (token, filter) {
    const { query, query2 } = getQuery(filter);

    await ctx.api.order.prepareJoinStats(token, { query });

    const stats = await ctx.api.order.getJoinStats(token, {
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

    const rounds = await ctx.api.order.getJoinStats(token, {
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

    return {
        stats,
        rounds
    }
}

function getDays (from, to) {
    const days = [];
    const day = from.clone();

    while(day.isBefore(to, "day") || day.isSame(to, "day")) {
        days.push({
            day: day.clone()
        });
        day.add(1, "day");
    }
    
    return days;
}

function getPercent (n1, n2) {
    return ((n1/n2)*100).toFixed(2);
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

const ROUND1 = "Круг 1";
const ROUND2 = "Круг 2";
const ROUND3 = "Круг 3";
const TOTAL = "Итого";

const HUMANIZE_STATUS = {
    [__.ORDER_STATUS.NOT_PROCESSED]: "Поступило заказов за день",
    [__.ORDER_STATUS.DONE]: "Согласован",
    [__.ORDER_STATUS.DONE_PICKUP]: "ПВЗ",
    [__.ORDER_STATUS.DENY]: "отказ",
    [__.ORDER_STATUS.UNDER_CALL]: "недозвон",
    [__.ORDER_STATUS.REPLACE_DATE]: "Перенос звонка"
}

const IGNORED_STATUSES_IN_TT_CALC = {
    [__.ORDER_STATUS.NOT_PROCESSED]: 1
}

get("/getStatsByRegion", token(), setXlsx("call_stats_by_region"), async (req, res) => {
    const filter = req.query;

    if (!(
        filter.from &&
        filter.to
    )) {
        return res.send("Error: You_should_have_filter.from_and_filter.to")
    }

    const dateFrom = moment(filter.from, ddFormat);
    const dateTo = moment(filter.to, ddFormat);
    const arrOfDays = getDays(dateFrom, dateTo);
    const { stats } = await getStaysByDay(res.locals.token, filter);
    const statsByRegion = _.groupBy(stats.list, "_id.region");
    const xlsxData = [];

    statsByRegion["Итого по регионам"]

    // region 
    _.each(statsByRegion, (stats, region) => {
        const rounds = [
            ROUND1,
            ROUND2,
            ROUND3,
            TOTAL
        ]

        _.each(rounds, round => {

            const xlsxRegionData = _.reduce(__.ORDER_STATUS, (memo, status) => {
                memo[status] = [`${status} (${HUMANIZE_STATUS[status]})`];
                return memo;
            }, {
                month: [""],
                date: [ "Регионы" ],
                nameOfWeek: [`${region} ${round}`],
                underCallCurrent: ["under_call (недозвон) по заказам за сег день"],
                total: ["итого"]
            });

            // days
            _.each(arrOfDays, ({ day }) => {
                day.locale("ru");
                const monthName = day.format("MMMM");
                const currDayStats = _.find(stats, s => s._id.date === day.format("DD-MM-YYYY"));

                xlsxRegionData.month.push(_.includes(xlsxRegionData.month, monthName) ? "" : monthName);
                xlsxRegionData.date.push(day.format("DD"));
                xlsxRegionData.nameOfWeek.push(day.format("dd"));

                if (!currDayStats) {
                    _.each(__.ORDER_STATUS, status => {
                        xlsxRegionData[status].push("");
                    });
                    xlsxRegionData.total.push("");
                    return;
                }

                const roundMap = {
                    [ROUND1]: {},
                    [ROUND2]: {}
                }
        
                _.each(currDayStats.rounds, round => {
                    if (!roundMap[ROUND1][round.orderId]) {
                        roundMap[ROUND1][round.orderId] = round.status;
                        return;
                    }

                    if (
                        roundMap[ROUND1][round.orderId] &&
                        !roundMap[ROUND2][round.orderId]
                    ) roundMap[ROUND2][round.orderId] = round.status;
                });

                let total = 0;
                _.each(__.ORDER_STATUS, status => {
                    if (roundMap[round]) {
                        const count = _(roundMap[round]).values().filter(s => s === status).value().length;
                        xlsxRegionData[status].push(count)

                        if (!IGNORED_STATUSES_IN_TT_CALC[status]) total += count;
                        return;
                    } 
                    
                    if (round === ROUND3) {
                        const countR1 = _(roundMap[ROUND1]).values().filter(s => s === status).value().length;
                        const countR2 = _(roundMap[ROUND2]).values().filter(s => s === status).value().length;
                        const countR3 = (currDayStats[status] || 0) - countR1 - countR2;

                        xlsxRegionData[status].push(countR3);
                        if (!IGNORED_STATUSES_IN_TT_CALC[status]) total += countR3;
                        return;
                    }
                        
                    xlsxRegionData[status].push(currDayStats[status] || 0)
                    total += currDayStats[status];
                });

                xlsxRegionData.total.push(total)
                if (round !== TOTAL) return;

                const notProcessed = _.filter(currDayStats.rounds, _.matches({ status: __.ORDER_STATUS.NOT_PROCESSED }));
                let underCallCurrent = 0;
                _.each(notProcessed, stat => {
                    underCallCurrent += _.filter(currDayStats.rounds, _.matches({ 
                        status: __.ORDER_STATUS.UNDER_CALL,
                        orderId: stat.orderId
                    })).length;
                });
                xlsxRegionData.underCallCurrent.push(underCallCurrent);
            });

            xlsxData.push(xlsxRegionData.month);
            xlsxData.push(xlsxRegionData.date);
            xlsxData.push(xlsxRegionData.nameOfWeek)

            _.each(__.ORDER_STATUS, status => {
                xlsxData.push(xlsxRegionData[status]);
            
                if (!(
                    status === __.ORDER_STATUS.UNDER_CALL &&
                    round === TOTAL
                )) return;

                xlsxData.push(xlsxRegionData.underCallCurrent);
            });



            fillEmptyRow();
            xlsxData.push(xlsxRegionData.total);
            fillEmptyRow();
        });
    });

    const buff = xlsx.build([
        { 
            name: "Stats By Region", 
            data: xlsxData 
        }
    ], {
        "!cols": [
            { wch: 40 },
            ..._.map(arrOfDays, () => ({ wch: 3 }))
        ]
    });

    res.send(buff);

    function fillEmptyRow () {
        const row = [];
        xlsxData.push(row);      
    }
});

get("/getStats", token(), setXlsx("call_stats"), async (req, res) => {
    const { rounds, stats } = await getStatsWithRounds(res.locals.token, req.query);
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

get("/getStatsByDay", token(), setXlsx("call_stats_by_day"), async (req, res) => {
    const filter = req.query;
    const t = res.locals.token;

    if (!(
        filter.from &&
        filter.to
    )) {
        return res.send("Error: You_should_have_filter.from_and_filter.to")
    }

    const { query, query2 } = getQuery(filter);
    const mainQuery = Object.assign(query, query2);

    await ctx.api.order.prepareJoinStats(t, { query });
    const orders = await ctx.api.order.getJoinStats(t, {
       query: mainQuery,
       fields: {
           _id: 1,
           orderId: 1,
           status: 1,
           _i_operatorTimeUsage: 1,
           _dt: 1
       },
       sort: {
           _dt: -1
       }
    });

    const statsMap = _.reduce(orders.list, (memo, stat) => {
        const dd = moment(stat._dt).format("DD.MM.YYYY");
        memo[dd] = memo[dd] || [];
        const orderIdx = _.findIndex(memo[dd], _.matches({ orderId: stat.orderId }));
        const order = orderIdx === -1 ? stat : memo[dd][orderIdx];

        order.rounds = order.rounds || [];
        order.isNew = order.isNew || order.status === __.ORDER_STATUS.NOT_PROCESSED;
        order.count = order.count || 0;
        order.count++;
        order.status = stat.status;

        if (stat._i_operatorTimeUsage) {
            order.c = order._i_operatorTimeUsage || stat._i_operatorTimeUsage;
            order._i_operatorTimeUsage = (stat._i_operatorTimeUsage + order._i_operatorTimeUsage) / 2;
        }

        if (order.status !== __.ORDER_STATUS.NOT_PROCESSED) {
            order.rounds.push(order.status);
        }

        if (orderIdx === -1) memo[dd].push(order);

        return memo;
    }, {});

    const header = [
        "Показатели",
        "Итого"
    ]
    const endOnLastDay = [
        "Остаток на тек. период",
        0    
    ]
    const forwarded = [
        "Передано заказов",
        0
    ]
    const ttOrders = [
        "Итого заказов в работе",
        0
    ]
    const done = [
        "Согласованная дата доставки",
        0
    ]
    const doneNew = [
        "из них новых",
        0
    ]
    const round1 = [
        "1й круг",
        0
    ]
    const round1New = [
        "из них новых",
        0
    ]
    const round2 = [
        "2й круг",
        0
    ]
    const round2New = [
        "из них новых",
        0
    ]
    const round3 = [
        "3й круг",
        0
    ]
    const round3New = [
        "из них новых",
        0
    ]
    const selfPickUp = [
        "Самовывоз",
        0
    ]
    const selfPickUpNew = [
        "из них новых",
        0
    ]
    const deny = [
        "Отказ",
        0
    ]
    const denyNew = [
        "из них новых",
        0
    ]
    const undercall = [
        "Перенос звонка - Недоступен",
        0
    ]
    const undercallNew = [
        "из них новых",
        0
    ]
    const replaceDate = [
        "Перенос звонка - Просит перезвонить позднее",
        0
    ]
    const replaceDateNew = [
        "из них новых",
        0
    ]
    const newOrders = [
        "Новое, без попыток дозвона",
        0
    ]
    const operatorTimeAvg = [
        "Средняя длительность обработки заказа оператором",
        0
    ]
    const donePercent = [
        "% Согласованных",
        0
    ]
    const donePercentNew = [
        "% новых",
        0
    ]
    const denyPercent = [
        "% Отказов",
        0
    ]
    const denyPercentNew = [
        "% новых",
        0
    ]
    const replaceDatePercent = [
        "% Переносов",
        0
    ]
    const replaceDatePercentNew = [
        "% новых",
        0
    ]
    const undercallPercent = [
        "% Недозвонов",
        0
    ]
    const undercallPercentNew = [
        "% новых",
        0
    ]

    _.each(_.keys(statsMap).reverse(), (dd) => {
        const stats = statsMap[dd];
        header.push(dd);

        const ttCount = _.sumBy(stats, "count");
        const ttCountNew = _.sumBy(stats, s => s.isNew && s.count || 0);

        const _forwardedCount = _.filter(stats, s => 
            s.status === __.ORDER_STATUS.DONE || 
            s.status === __.ORDER_STATUS.DONE_PICKUP || 
            s.status === __.ORDER_STATUS.DENY || 
            s.status === __.ORDER_STATUS.REPLACE_DATE
        ).length;
        const _endOnLastDayCount = stats.length - _forwardedCount;
        const _ttOrders = stats.length;
        const _done = _.filter(stats, _.matches({ status: __.ORDER_STATUS.DONE })).length;
        const _doneNew = _.filter(stats, s => s.status === __.ORDER_STATUS.DONE && s.isNew).length;
        const _round1 = _.filter(stats, s => s.rounds[0]).length;
        const _round1New = _.filter(stats, s => s.rounds[0] && s.isNew).length;
        const _round2 = _.filter(stats, s => s.rounds[1]).length;
        const _round2New = _.filter(stats, s => s.rounds[1] && s.isNew).length;
        const _round3 = ttCount - (_round1 + _round2);
        const _round3New = ttCountNew - (_round1New + _round2New);
        const _selfPickUp = _.filter(stats, _.matches({ status: __.ORDER_STATUS.DONE_PICKUP })).length;
        const _selfPickUpNew = _.filter(stats, s => s.status === __.ORDER_STATUS.DONE_PICKUP && s.isNew).length;
        const _deny = _.filter(stats, s => s.status === __.ORDER_STATUS.DENY).length;
        const _denyNew = _.filter(stats, s => s.status === __.ORDER_STATUS.DENY && s.isNew).length;
        const _undercall = _.filter(stats, s => s.status === __.ORDER_STATUS.UNDER_CALL).length;
        const _undercallNew = _.filter(stats, s => s.status === __.ORDER_STATUS.UNDER_CALL && s.isNew).length;
        const _replaceDate = _.filter(stats, s => s.status === __.ORDER_STATUS.REPLACE_DATE).length;
        const _replaceDateNew = _.filter(stats, s => s.status === __.ORDER_STATUS.REPLACE_DATE && s.isNew).length;
        const _newOrders = _.filter(stats, s => s.isNew).length;
        const _operatorTimeAvg = _.sumBy(stats, "_i_operatorTimeUsage") / _.filter(stats, s => s._i_operatorTimeUsage).length || null;
        const _donePercent = getPercent(_done + _selfPickUp, stats.length);
        const _donePercentNew = getPercent(_doneNew + _selfPickUpNew, stats.length);
        const _denyPercent = getPercent(_deny, stats.length);
        const _denyPercentNew = getPercent(_denyNew, stats.length);
        const _replaceDatePercent = getPercent(_replaceDate, stats.length);
        const _replaceDatePercentNew = getPercent(_replaceDateNew, stats.length);
        const _undercallPercent = getPercent(_undercall, stats.length);
        const _undercallPercentNew = getPercent(_undercallNew, stats.length);

        endOnLastDay.push(_endOnLastDayCount);
        endOnLastDay[1] += _endOnLastDayCount;

        forwarded.push(_forwardedCount);
        forwarded[1] += _forwardedCount;

        ttOrders.push(_ttOrders);
        ttOrders[1] += _ttOrders;

        done.push(_done);
        done[1] += _done;

        doneNew.push(_doneNew);
        doneNew[1] += _doneNew;

        round1.push(_round1);
        round1[1] += _round1;

        round1New.push(_round1New);
        round1New[1] += _round1New;

        round2.push(_round2);
        round2[1] += _round2;

        round2New.push(_round2New);
        round2New[1] += _round2New;

        round3.push(_round3);
        round3[1] += _round3;

        round3New.push(_round3New);
        round3New[1] += _round3New;

        selfPickUp.push(_selfPickUp);
        selfPickUp[1] += _selfPickUp;

        selfPickUpNew.push(_selfPickUpNew);
        selfPickUpNew[1] += _selfPickUpNew;

        deny.push(_deny);
        deny[1] += _deny;

        denyNew.push(_denyNew);
        denyNew[1] += _denyNew;

        undercall.push(_undercall);
        undercall[1] += _undercall;

        undercallNew.push(_undercallNew);
        undercallNew[1] += _undercallNew;

        replaceDate.push(_replaceDate);
        replaceDate[1] += _replaceDate;

        replaceDateNew.push(_replaceDateNew);
        replaceDateNew[1] += _replaceDateNew;

        newOrders.push(_newOrders);
        newOrders[1] += _newOrders;

        operatorTimeAvg.push(_operatorTimeAvg);
        if (_operatorTimeAvg) {
            if (!operatorTimeAvg[1]) {
                operatorTimeAvg[1] = _operatorTimeAvg
            }
            operatorTimeAvg[1] = (_operatorTimeAvg + operatorTimeAvg[1]) / 2
        }

        donePercent.push(_donePercent);
        donePercentNew.push(_donePercentNew);
        denyPercent.push(_denyPercent);
        denyPercentNew.push(_denyPercentNew);
        replaceDatePercent.push(_replaceDatePercent);
        replaceDatePercentNew.push(_replaceDatePercentNew);
        undercallPercent.push(_undercallPercent);
        undercallPercentNew.push(_undercallPercentNew);
    });

    donePercent[1] = getPercent(done[1] + selfPickUp[1], orders.list.length);
    donePercentNew[1] = getPercent(doneNew[1] + selfPickUpNew[1], orders.list.length);

    denyPercent[1] = getPercent(deny[1], orders.list.length);
    denyPercentNew[1] = getPercent(denyNew[1], orders.list.length);

    replaceDatePercent[1] = getPercent(replaceDate[1], orders.list.length);
    replaceDatePercentNew[1] = getPercent(replaceDateNew[1], orders.list.length);

    undercallPercent[1] = getPercent(undercall[1], orders.list.length);
    undercallPercentNew[1] = getPercent(undercallNew[1], orders.list.length);

    const dataXlsx = [
        header,
        endOnLastDay,
        forwarded,
        ttOrders,
        done,
        round1,
        round1New,
        round2,
        round2New,
        round3,
        round3New,
        selfPickUp,
        selfPickUpNew,
        deny,
        denyNew,
        undercall,
        undercallNew,
        replaceDate,
        replaceDateNew,
        newOrders,
        operatorTimeAvg,
        donePercent,
        donePercentNew,
        denyPercent,
        denyPercentNew,
        replaceDatePercent,
        replaceDatePercentNew,
        undercallPercent,
        undercallPercentNew
    ];

    const buff = xlsx.build([
        { name: "Stats By Day", data: dataXlsx }
    ]);
    res.send(buff);
});