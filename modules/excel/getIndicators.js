const _ = require("lodash");
const moment = require("moment");
const __ = require("../api/__namespace");
const xlsx = require("node-xlsx");
const { 
  getStatsMap,
  getPercent
} = require("./helpers");

module.exports = {
  getIndicators
}

function getIndicators (ctx) {
  return async (req, res) => {
    const filter = req.query;
    const t = res.locals.token;

    if (!(
        filter.from &&
        filter.to
    )) {
        return res.send("Error: You_should_have_filter.from_and_filter.to")
    }

    const { statsMap } = await getStatsMap(t, filter, ctx);

    const header = ["Показатели", "Итого"];

    const remainsOrders = ["Остаток за пред. период", 0];
    const doneOrders = ["Согласованная дата доставки", 0];
    const doneCalls = ["кол-во попыток дозвона", 0];
    const donePickupOrders = ["Самовывоз", 0];
    const donePickupCalls = ["кол-во попыток дозвона", 0];
    const replaceDateOrders = ["Перенесли звонок", 0];
    const replaceDateCalls = ["кол-во попыток дозвона", 0];
    const denyOrders = ["Отказ", 0];
    const denyCalls = ["кол-во попыток дозвона", 0];
    const undercallOrders = ["Не дозвонились", 0];
    const undercallCalls = ["кол-во попыток дозвона", 0];
    const notProcessedOrders = ["Не вышло на прозвон", 0];
    const operatorAvgTime = ["Средняя длительность обработки заказа от загружен в систему до получения финального статуса done или pick_up", 0];

    const newOrders = ["Передано новых заказов", 0];
    const newDoneOrders = ["Согласованная дата доставки", 0];
    const newDoneCalls = ["кол-во попыток дозвона", 0];
    const newDonePickupOrders = ["Самовывоз", 0];
    const newDonePickupCalls = ["кол-во попыток дозвона", 0];
    const newReplaceDateOrders = ["Перенесли звонок", 0];
    const newReplaceDateCalls = ["кол-во попыток дозвона", 0];
    const newDenyOrders = ["Отказ", 0];
    const newDenyCalls = ["кол-во попыток дозвона", 0];
    const newUndercallOrders = ["Не дозвонились", 0];
    const newUndercallCalls = ["кол-во попыток дозвона", 0];
    const newNotProcessedOrders = ["Не вышло на прозвон", 0];

    const incomingCalls = ["Входящая линия ( перезвон на пропущенный звонок)"];
    const incomingDone = ["Согласованная дата доставки"];
    const incomingDeny = ["Отказ"];
    const incomingOperatorAvgTime = ["Средняя длительность обработки заказа от загружен в систему до получения финального статуса done или pick_up"]

    const ttDone = ["Всего согласованная дата доставки", 0];
    const ttDonePickup = ["Всего самовывоз", 0];
    const ttReplaceDate = ["Всего перенесли звонок", 0];
    const ttDeny = ["Всего отказ", 0];
    const ttUndercall = ["Всего недоступен", 0];
    const ttNotProcessed = ["Всего не вышло на прозвон", 0];
    const total = ["Всего обработано", 0];

    const ttDonePercent = ["% Согласованных", 0];
    const ttDenyPercent = ["% Отказов", 0];
    const ttReplaceDatePercent = ["% Переносов", 0];
    const ttUndercallPercent = ["% Недозвонов", 0];

    _.each(statsMap, (stats, dd) => {
      header.push(dd);

      const _remainsOrders = _.filter(stats, s => !s.isNew).length;
      const _doneOrders = _.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.DONE).length;
      const _doneCalls =  _.sumBy(_.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.DONE), "count");
      const _donePickupOrders = _.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.DONE_PICKUP).length;
      const _donePickupCalls = _.sumBy(_.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.DONE_PICKUP), "count");
      const _replaceDateOrders = _.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.REPLACE_DATE).length
      const _replaceDateCalls = _.sumBy(_.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.REPLACE_DATE), "count");
      const _denyOrders = _.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.DENY).length;
      const _denyCalls = _.sumBy(_.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.DENY), "count");
      const _undercallOrders = _.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.UNDER_CALL).length;
      const _undercallCalls = _.sumBy(_.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.UNDER_CALL), "count");
      const _notProcessedOrders = _.filter(stats, s => !s.isNew && s.status === __.ORDER_STATUS.NOT_PROCESSED).length;
      const _operatorAvgTime = (_.sumBy(stats, s => !s.isNew && s._i_operatorTimeUsage || 0) / _.filter(stats, s => !s.isNew && s._i_operatorTimeUsage).length) || null;
      
      const _newOrders = _.filter(stats, s => s.isNew).length;
      const _newDoneOrders = _.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.DONE).length;
      const _newDoneCalls =  _.sumBy(_.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.DONE), "count");
      const _newDonePickupOrders = _.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.DONE_PICKUP).length;
      const _newDonePickupCalls = _.sumBy(_.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.DONE_PICKUP), "count");
      const _newReplaceDateOrders = _.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.REPLACE_DATE).length
      const _newReplaceDateCalls = _.sumBy(_.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.REPLACE_DATE), "count");
      const _newDenyOrders = _.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.DENY).length;
      const _newDenyCalls = _.sumBy(_.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.DENY), "count");
      const _newUndercallOrders = _.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.UNDER_CALL).length;
      const _newUndercallCalls = _.sumBy(_.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.UNDER_CALL), "count");
      const _newNotProcessedOrders = _.filter(stats, s => s.isNew && s.status === __.ORDER_STATUS.NOT_PROCESSED).length;

      const _ttDone = _.filter(stats, _.matches({ status: __.ORDER_STATUS.DONE })).length;
      const _ttDonePickup = _.filter(stats, _.matches({ status: __.ORDER_STATUS.DONE_PICKUP })).length;
      const _ttReplaceDate = _.filter(stats, _.matches({ status: __.ORDER_STATUS.REPLACE_DATE })).length;
      const _ttDeny = _.filter(stats, _.matches({ status: __.ORDER_STATUS.DENY })).length;
      const _ttUndercall = _.filter(stats, _.matches({ status: __.ORDER_STATUS.UNDER_CALL })).length;
      const _ttNotProcessed = _.filter(stats, _.matches({ status: __.ORDER_STATUS.NOT_PROCESSED })).length;
      const _total = stats.length;

      const _ttDonePercent = getPercent(_ttDone + _ttDonePickup, _total);
      const _ttDenyPercent = getPercent(_ttDeny, _total);
      const _ttReplaceDatePercent = getPercent(_ttReplaceDate, _total);
      const _ttUndercallPercent = getPercent(_ttUndercall, _total);

      remainsOrders.push(_remainsOrders);
      doneOrders.push(_doneOrders);
      doneCalls.push(_doneCalls);
      donePickupOrders.push(_donePickupOrders);
      donePickupCalls.push(_donePickupCalls);
      replaceDateOrders.push(_replaceDateOrders);
      replaceDateCalls.push(_replaceDateCalls);
      denyOrders.push(_denyOrders);
      denyCalls.push(_denyCalls);
      undercallOrders.push(_undercallOrders);
      undercallCalls.push(_undercallCalls);
      notProcessedOrders.push(_notProcessedOrders);
      operatorAvgTime.push(_operatorAvgTime);

      newOrders.push(_newOrders);
      newDoneOrders.push(_newDoneOrders);
      newDoneCalls.push(_newDoneCalls);
      newDonePickupOrders.push(_newDonePickupOrders);
      newDonePickupCalls.push(_newDonePickupCalls);
      newReplaceDateOrders.push(_newReplaceDateOrders);
      newReplaceDateCalls.push(_newReplaceDateCalls);
      newDenyOrders.push(_newDenyOrders);
      newDenyCalls.push(_newDenyCalls);
      newUndercallOrders.push(_newUndercallOrders);
      newUndercallCalls.push(_newUndercallCalls);
      newNotProcessedOrders.push(_newNotProcessedOrders);

      ttDone.push(_ttDone);
      ttDonePickup.push(_ttDonePickup);
      ttReplaceDate.push(_ttReplaceDate);
      ttDeny.push(_ttDeny);
      ttUndercall.push(_ttUndercall);
      ttNotProcessed.push(_ttNotProcessed);
      total.push(_total);

      ttDonePercent.push(_ttDonePercent);
      ttDenyPercent.push(_ttDenyPercent);
      ttReplaceDatePercent.push(_ttReplaceDatePercent);
      ttUndercallPercent.push(_ttUndercallPercent);

      remainsOrders[1] += _remainsOrders;
      doneOrders[1] += _doneOrders;
      doneCalls[1] += _doneCalls;
      donePickupOrders[1] += _donePickupOrders;
      donePickupCalls[1] += _donePickupCalls;
      replaceDateOrders[1] += _replaceDateOrders;
      replaceDateCalls[1] += _replaceDateCalls;
      denyOrders[1] += _denyOrders;
      denyCalls[1] += _denyCalls;
      undercallOrders[1] += _undercallOrders;
      undercallCalls[1] += _undercallCalls;
      notProcessedOrders[1] += _notProcessedOrders;

      if (_operatorAvgTime) {
        if (!operatorAvgTime[1]) {
          operatorAvgTime[1] = _operatorAvgTime;
        }
        operatorAvgTime[1] = (_operatorAvgTime + operatorAvgTime[1]) / 2;
      }

      newOrders[1] += _newOrders;
      newDoneOrders[1] += _newDoneOrders;
      newDoneCalls[1] += _newDoneCalls;
      newDonePickupOrders[1] += _newDonePickupOrders;
      newDonePickupCalls[1] += _newDonePickupCalls;
      newReplaceDateOrders[1] += _newReplaceDateOrders;
      newReplaceDateCalls[1] += _newReplaceDateCalls;
      newDenyOrders[1] += _newDenyOrders;
      newDenyCalls[1] += _newDenyCalls;
      newUndercallOrders[1] += _newUndercallOrders;
      newUndercallCalls[1] += _newUndercallCalls;

      ttDone[1] += _ttDone
      ttDonePickup[1] += _ttDonePickup
      ttReplaceDate[1] += _ttReplaceDate
      ttDeny[1] += _ttDeny
      ttUndercall[1] += _ttUndercall
      ttNotProcessed[1] += _ttNotProcessed
      total[1] += _total

      ttDonePercent[1] = getPercent(ttDone[1], total[1]);
      ttDenyPercent[1] = getPercent(ttDeny[1], total[1]);
      ttReplaceDatePercent[1] = getPercent(ttReplaceDate[1], total[1]);
      ttUndercallPercent[1] = getPercent(ttUndercall[1], total[1]);
    });

    const formatOperatorTime = _.map(operatorAvgTime, (ms, idx) => {
      if (idx === 0) return ms;
      return moment().startOf("day").add(ms).format("HH:mm:ss");
    });

    const dataXlsx = [
      header,
      [],
      remainsOrders,
      doneOrders,
      doneCalls,
      donePickupOrders,
      donePickupCalls,
      replaceDateOrders,
      replaceDateCalls,
      denyOrders,
      denyCalls,
      undercallOrders,
      undercallCalls,
      notProcessedOrders,
      formatOperatorTime,
      [],
      newOrders,
      newDoneOrders,
      newDoneCalls,
      newDonePickupOrders,
      newDonePickupCalls,
      newReplaceDateOrders,
      newReplaceDateCalls,
      newDenyOrders,
      newDenyCalls,
      newUndercallOrders,
      newUndercallCalls,
      newNotProcessedOrders,
      [],
      incomingCalls,
      incomingDone,
      incomingDeny,
      incomingOperatorAvgTime,
      [],
      ttDone,
      ttDonePickup,
      ttReplaceDate,
      ttDeny,
      ttUndercall,
      ttNotProcessed,
      total,
      [],
      ttDonePercent,
      ttDenyPercent,
      ttReplaceDatePercent,
      ttUndercallPercent
    ]

    const buff = xlsx.build([
      { name: "Indicators", data: dataXlsx }
    ]);
    res.send(buff);
  }
} 