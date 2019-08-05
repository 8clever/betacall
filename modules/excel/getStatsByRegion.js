
const moment = require("moment");
const _ = require("lodash");
const {
  getStaysByDay,
  getDays,
  ddFormat
} = require("./helpers");
const xlsx = require("node-xlsx");
const { ORDER_STATUS } = require("../api/__namespace");
const __ = {
    ORDER_STATUS: _.omit(ORDER_STATUS, ["SKIP"])
}

module.exports ={
  getStatsByRegion
}

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

function getStatsByRegion (ctx) {
  return async (req, res) => {
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
    const { stats } = await getStaysByDay(res.locals.token, filter, ctx);
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
  }
}
