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
  return (dto = {}) => {
    return new Promise(res => {
      const id = Math.floor(Math.random() * 10000000);
      emitter.on(id, res)
      client.publish(topic, Object.assign({ id }, dto));
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
        emitter.emit(message.id, message);
      }
    });

    return { api };
}

/**
 * 
 * @param {*} t 
 * @param {*} p 
 * @param {*} p.order 
 */
api.textToSpeech = generateMethod(METHODS.TEXT_TO_SPEECH);