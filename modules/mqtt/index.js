const mqtt = require("mqtt");
const EventEmitter = require("events");
const _ = require("lodash");
const moment = require("moment")

let api = {};
let ctx = null;
let client = null;

const METHODS = {
  TEXT_TO_SPEECH: "textToSpeech"
}

const SUBSCRIBTIONS = {
  getNearDeliveryDatesIntervals: async ({ orderId }) => {
    const t = await ctx.api.scheduler._getRobotToken("", {});
    const dates = await ctx.api.order.getNearDeliveryDatesIntervals(t, { orderId });
    return dates;
  },
  getOrder: async ({ orderId }) => {
    const t = await ctx.api.scheduler._getRobotToken("", {});
    
    const [ order, settings ] = await Promise.all([
      ctx.api.order.getOrderByID(t, { orderId }),
      ctx.api.settings.getSettings(t, {})
    ]);
    
    const translit = settings.markets.find(m => m.key === order.orderUrl);
    order.marketName = translit ? translit.value : order.orderUrl;

    return order;
  },
  orderDoneRobot: async ({ orderId, callId, robotDeliveryDate }) => {
    await ctx.api.asterisk.__releaseCall("", { callId });

    const intervals = [
      { from: "10:00:00", to: "18:00:00" },
      { from: "10:00:00", to: "22:00:00" }
    ]

    const t = await ctx.api.scheduler._getRobotToken("", {});
    const order = await ctx.api.order.getOrderByID(t, { orderId });

    _.set(order, "desiredDateDelivery.date", robotDeliveryDate);

    let error = null;

    for (const i of intervals) {
      _.set(order, "desiredDateDelivery.timeInterval.bTime", i.from);
      _.set(order, "desiredDateDelivery.timeInterval.eTime", i.to);

      try {
          await ctx.api.order.doneOrder(t, { order, metadata: {
              orderId,
              callId
          }});
          return;
      } catch (e) {
        error = e;
      }
    }

    throw error;
  },
  orderRecallLater: async ({ orderId, callId }) => {
    await ctx.api.asterisk.__releaseCall("", { callId });
    
    const t = await ctx.api.scheduler._getRobotToken("", {});
    const replaceDate = moment().add(1, "day").toDate();
    const order = await ctx.api.order.getOrderByID(t, { orderId });
    await ctx.api.order.replaceCallDate(t, { order, replaceDate, metadata: {
        orderId,
        callId
    }})
  }
}

const emitter = new EventEmitter();

function generateId () {
  return Math.floor(Math.random() * 10000000);
}

function generateMethod (topic) {
  return (t, dto = {}) => {
    return new Promise(res => {
      const id = generateId();
      emitter.once(id, res)
      client.publish(topic, JSON.stringify(Object.assign({ id }, dto)));
    });
  }
}

module.exports.deps = [];
module.exports.init = async function (...args) {
    [ ctx ] = args;

    const isON = (
      ctx.cfg.mqtt.textToSpeech
    )

    if (isON) {
      client = mqtt.connect(`mqtt://${ctx.cfg.mqtt.main.host}`);

      const resMethods = Object.values(METHODS).map(m => `${m}Res`);
      const subscribeMethods = Object.keys(SUBSCRIBTIONS);
      const clientSubscribers = [
        ...resMethods,
        ...subscribeMethods
      ]
      
      for (const topic of clientSubscribers) {
        client.subscribe(topic);
      }
  
      client.on("message", (topic, message) => {
        if (resMethods.includes(topic)) {
          const obj = JSON.parse(message.toString());
          emitter.emit(obj.id, obj);
        }

        if (SUBSCRIBTIONS[topic]) {
          const obj = JSON.parse(message.toString());
          const id = obj.id || generateId();
          const responseTopic = topic + "Res";

          SUBSCRIBTIONS[topic](obj)
            .then(res => {
              client.publish(responseTopic, JSON.stringify({
                id,
                status: "success",
                data: res || null
              }));
            })
            .catch(err => {
              console.log(`Error in topic: ${topic}`);
              console.log(err);

              client.publish(responseTopic, JSON.stringify({
                id,
                status: "error",
                errorMessage: err.message
              }));
            })
        }
      });
    }

    return { api };
}

for (const topic of Object.values(METHODS)) {
  api[topic] = generateMethod(topic);
}