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
    const order = await ctx.api.order.getOrderByID(t, { orderId });
    return order;
  },
  orderDone: async ({ orderId, callId, robotDeliveryDate }) => {
    await ctx.api.asterisk.__releaseCall("", { callId });

    const t = await ctx.api.scheduler._getRobotToken("", {});
    const order = await ctx.api.order.getOrderByID(t, { orderId });
    _.set(order, "desiredDateDelivery.date", robotDeliveryDate);
    await ctx.api.order.doneOrder(t, { order, metadata: {
      orderId,
      callId
    }});
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

function generateMethod (topic) {
  return (t, dto = {}) => {
    return new Promise(res => {
      const id = Math.floor(Math.random() * 10000000);
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
          SUBSCRIBTIONS[topic](obj)
            .then(res => {
              if (!res) return;
              client.publish(topic + "Res", JSON.stringify(res));
            })
            .catch(err => {
              console.log(`Error in topic: ${topic}`);
              console.log(err);
            })
        }
      });
    }

    return { api };
}

for (const topic of Object.values(METHODS)) {
  api[topic] = generateMethod(topic);
}