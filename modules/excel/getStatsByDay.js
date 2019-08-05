
const moment = require("moment");
const _ = require("lodash");
const xlsx = require("node-xlsx");
const { ORDER_STATUS } = require("../api/__namespace");
const __ = {
    ORDER_STATUS: _.omit(ORDER_STATUS, ["SKIP"])
}
const { 
  getStatusByOrder,
  getQuery,
  getPercent
} = require("./helpers");

module.exports = {
  getStatsByDay
}

function getStatsByDay (ctx) {
  return async (req, res) => {
    const filter = req.query;
    const t = res.locals.token;

    if (!(
        filter.from &&
        filter.to
    )) {
        return res.send("Error: You_should_have_filter.from_and_filter.to")
    }

    const { query, query2 } = getQuery(filter, ctx);
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
           _dt: 1
       }
    });

    const statsMap = _.reduce(orders.list, (memo, stat) => {
        const dd = moment(stat._dt).format("DD.MM.YYYY");
        memo[dd] = memo[dd] || [];
        const orderIdx = _.findIndex(memo[dd], _.matches({ orderId: stat.orderId }));
        const order = orderIdx === -1 ? stat : memo[dd][orderIdx];

        order.status = getStatusByOrder(order.status || stat.status, stat.status)
        order.rounds = order.rounds || [];
        order.isNew = order.isNew || stat.status === __.ORDER_STATUS.NOT_PROCESSED;
        order.isForwarded = order.isForwarded || (
            order.status === __.ORDER_STATUS.DONE || 
            order.status === __.ORDER_STATUS.DONE_PICKUP || 
            order.status === __.ORDER_STATUS.DENY || 
            order.status === __.ORDER_STATUS.REPLACE_DATE
        )
        order.count = order.count || 0;
        order.count++;

        if (stat._i_operatorTimeUsage) {
            order.c = order._i_operatorTimeUsage || stat._i_operatorTimeUsage;
            order._i_operatorTimeUsage = (stat._i_operatorTimeUsage + order._i_operatorTimeUsage) / 2;
        }

        if (stat.status !== __.ORDER_STATUS.NOT_PROCESSED) {
            order.rounds.push(stat.status);
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
    const newOrdersWithoutAttempts = [
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

    _.each(_.keys(statsMap), (dd) => {
        header.push(dd);

        const stats = statsMap[dd];
        
        const _forwardedCount = _.filter(stats, s => s.isForwarded).length;
        const _endOnLastDayCount = stats.length - _forwardedCount;
        const _ttOrders = stats.length;
        
        const _done = _.filter(stats, _.matches({ status: __.ORDER_STATUS.DONE })).length;
        const _doneNew = _.filter(stats, s => s.status === __.ORDER_STATUS.DONE && s.isNew).length;
        const _round1 = _.filter(stats, s => s.rounds[0] === __.ORDER_STATUS.DONE).length;
        const _round1New = _.filter(stats, s => s.rounds[0] === __.ORDER_STATUS.DONE && s.isNew).length;
        const _round2 = _.filter(stats, s => s.rounds[1] === __.ORDER_STATUS.DONE).length;
        const _round2New = _.filter(stats, s => s.rounds[1] === __.ORDER_STATUS.DONE && s.isNew).length;
        const _round3 = _.filter(stats, s => s.rounds.slice(2).includes(__.ORDER_STATUS.DONE)).length;
        const _round3New = _.filter(stats, s => s.rounds.slice(2).includes(__.ORDER_STATUS.DONE) && s.isNew).length;
        
        const _selfPickUp = _.filter(stats, _.matches({ status: __.ORDER_STATUS.DONE_PICKUP })).length;
        const _selfPickUpNew = _.filter(stats, s => s.status === __.ORDER_STATUS.DONE_PICKUP && s.isNew).length;
        const _deny = _.filter(stats, s => s.status === __.ORDER_STATUS.DENY).length;
        const _denyNew = _.filter(stats, s => s.status === __.ORDER_STATUS.DENY && s.isNew).length;
        const _undercall = _.filter(stats, s => s.status === __.ORDER_STATUS.UNDER_CALL).length;
        const _undercallNew = _.filter(stats, s => s.status === __.ORDER_STATUS.UNDER_CALL && s.isNew).length;
        const _replaceDate = _.filter(stats, s => s.status === __.ORDER_STATUS.REPLACE_DATE).length;
        const _replaceDateNew = _.filter(stats, s => s.status === __.ORDER_STATUS.REPLACE_DATE && s.isNew).length;
        const _newOrdersWithoutAttempts = _.filter(stats, s => s.isNew && !s.rounds.length).length;
        
        const _operatorTimeAvg = (_.sumBy(stats, s => s._i_operatorTimeUsage || 0) / _.filter(stats, s => s._i_operatorTimeUsage).length) || null;
        const _donePercent = getPercent(_done + _selfPickUp, _ttOrders);
        const _donePercentNew = getPercent(_doneNew + _selfPickUpNew, _ttOrders);
        const _denyPercent = getPercent(_deny, _ttOrders);
        const _denyPercentNew = getPercent(_denyNew, _ttOrders);
        const _replaceDatePercent = getPercent(_replaceDate, _ttOrders);
        const _replaceDatePercentNew = getPercent(_replaceDateNew, _ttOrders);
        const _undercallPercent = getPercent(_undercall, _ttOrders);
        const _undercallPercentNew = getPercent(_undercallNew, _ttOrders);

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

        newOrdersWithoutAttempts.push(_newOrdersWithoutAttempts);
        newOrdersWithoutAttempts[1] += _newOrdersWithoutAttempts;

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

    donePercent[1] = getPercent(done[1] + selfPickUp[1], ttOrders[1]);
    donePercentNew[1] = getPercent(doneNew[1] + selfPickUpNew[1], ttOrders[1]);

    denyPercent[1] = getPercent(deny[1], ttOrders[1]);
    denyPercentNew[1] = getPercent(denyNew[1], ttOrders[1]);

    replaceDatePercent[1] = getPercent(replaceDate[1], ttOrders[1]);
    replaceDatePercentNew[1] = getPercent(replaceDateNew[1], ttOrders[1]);

    undercallPercent[1] = getPercent(undercall[1], ttOrders[1]);
    undercallPercentNew[1] = getPercent(undercallNew[1], ttOrders[1]);

    const formatOperatorTime = _.map(operatorTimeAvg, (ms, idx) => {
        if (idx === 0) return ms;
        return moment().startOf("day").add(ms).format("HH:mm:ss");
    });

    const dataXlsx = [
        header,
        endOnLastDay,
        forwarded,
        ttOrders,
        [],
        done,
        round1,
        round1New,
        round2,
        round2New,
        round3,
        round3New,
        [],
        selfPickUp,
        selfPickUpNew,
        deny,
        denyNew,
        undercall,
        undercallNew,
        replaceDate,
        replaceDateNew,
        newOrdersWithoutAttempts,
        [],
        formatOperatorTime,
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
  }
} 