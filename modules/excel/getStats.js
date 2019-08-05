

const moment = require("moment");
const _ = require("lodash");
const {
  getStatsWithRounds,
  ddFormat
} = require("./helpers");
const xlsx = require("node-xlsx");

module.exports = {
  getStats
}

function getStats (ctx) {
  return async (req, res) => {
    
    const { rounds, stats } = await getStatsWithRounds(res.locals.token, req.query, ctx);
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
  }
}