const parser = require("cookie");
const __ = require("../api/__namespace");
const moment = require("moment");
const _ = require("lodash");
const ddFormat = "DD-MM-YYYY";

module.exports = {
  generateAsyncMiddles,
  get,
  generateName,
  setXlsx,
  token,
  getQuery,
  getStaysByDay,
  getStatsWithRounds,
  getDays,
  getPercent,
  getStatusByOrder,
  getStatsMap,
  ddFormat
}

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

function get (Router) {
  return function (path, ...middlewares) {
    Router.get(path, ...generateAsyncMiddles(middlewares));
  }
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

function getQuery (filter, ctx) {
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

  _.each(ctx.cfg.ami.blackList, black => {
    const re = new RegExp(black);
    query.$and.push({
        _s_phone: {
            $not: re
        }
    })
  });

  console.log(query)

  _.each(ctx.cfg.ami.blackMarkets, black => {
    query.$and.push({
        _s_marketName: {
            $ne: black
        }
    })
  });

  return {
      query,
      query2
  }
}

async function getStaysByDay (token, filter, ctx) {
  const { query, query2 } = getQuery(filter, ctx);

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

async function getStatsWithRounds (token, filter, ctx) {
  const { query, query2 } = getQuery(filter, ctx);

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
  if (!n2) return (0).toFixed(2);
  return ((n1/n2)*100).toFixed(2);
}

function getStatusByOrder (status, nextStatus) {
  switch(status) {
      case __.ORDER_STATUS.DONE:
      case __.ORDER_STATUS.DONE_PICKUP:
      case __.ORDER_STATUS.DENY:
      case __.ORDER_STATUS.REPLACE_DATE:
          return status;
      default:
          return nextStatus;
  }
}

async function getStatsMap (t, filter, ctx) {
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

        if (order.isNew && !order._dtstart) {
            order._dtstart = stat._dt;
        }

        if (order.isNew && order.isForwarded) {
            order._i_timeOrderProcessed = moment(stat._dt).valueOf() - moment(order._dtstart).valueOf();
        }

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

    return {
      statsMap,
      orders
    }
}