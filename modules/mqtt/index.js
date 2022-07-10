const mqtt = require("mqtt");
const EventEmitter = require("events");

let api = {};
let ctx = null;
let client = null;

const METHODS = {
  TEXT_TO_SPEECH: "textToSpeech"
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

    client = mqtt.connect(`mqtt://${ctx.cfg.mqtt.main.host}`);

    const resMethods = Object.values(METHODS).map(m => `${m}Res`);

    client.on("message", (topic, message) => {
      if (resMethods.includes(topic)) {
        const obj = JSON.parse(message);
        emitter.emit(obj.id, obj);
      }
    });

    return { api };
}

for (const topic of Object.values(METHODS)) {
  api[topic] = generateMethod(topic);
}