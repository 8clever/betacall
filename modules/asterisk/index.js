const aio = require("asterisk.io");
const __ = require("../api/__namespace");
const RosReestr = require("./RosReestr");
const rosreestr = new RosReestr();
const _ = require("lodash");

let api = {};
let ami = null;
let ctx = null;
let asteriskON = 1;

module.exports.deps = [];
module.exports.init = async function (...args) {
    [ ctx ] = args;
    let config = ctx.cfg;
    
    ami = aio.ami(
        config.ami.host,
        config.ami.port,
        config.ami.username,
        config.ami.password
    );
    
    await new Promise((resolve, reject) => {
        ami.on('error', function(err){
            if (config.env === "production") {
                return reject(err);
            }
            console.error(`INVALID CONNECTION TO ASTERISK: ${config.ami.host}:${config.ami.port}`);
            resolve();
        });

        ami.on('ready', function(){

            ami.on("eventCoreShowChannelsComplete", evt => {
                ami.emit(evt.Event + evt.ActionID, evt);
            });

            ami.on("eventCoreShowChannel", evt => {
                ami.emit(evt.Event + evt.ActionID, evt);
            });

            ami.on("eventPeerStatus", evt => {
                asteriskON = evt.PeerStatus === "Registered";
            });

            ami.on("eventHangup", evt => {
                if (!(
                    evt.Uniqueid
                )) return;

                if (evt.Cause === "777") {
                    ami.emit(evt.Uniqueid, { 
                        status: __.CALL_STATUS.DONE_BOT,
                        id: evt.Uniqueid
                    });
                    return;
                }

                if (
                    evt.Cause === "1" ||
                    evt.Cause === "16" ||
                    evt.Cause === "17" ||
                    evt.Cause === "18" ||
                    evt.Cause === "19" ||
                    evt.Cause === "20" ||
                    evt.Cause === "21" ||
                    evt.Cause === "22" ||
                    evt.Cause === "34" ||
                    evt.Cause === "58" ||
                    evt.Cause === "127"
                ) {
                    ami.emit(evt.Uniqueid, { 
                        status: __.CALL_STATUS.UNNAVAILABLE,
                        id: evt.Uniqueid
                    });
                    return;
                }

                console.log(evt.Cause, evt["Cause-txt"]);
                ami.emit(evt.Uniqueid, { 
                    status: __.CALL_STATUS.CONNECTING_PROBLEM ,
                    id: evt.Uniqueid
                });
            });

            ami.on("eventDialEnd", evt => {
                if (!(
                    evt.Uniqueid &&
                    evt.DialStatus === "ANSWER"
                )) return;

                ami.emit(evt.Uniqueid, {
                    id: evt.Uniqueid,
                    status: __.CALL_STATUS.DONE,
                    exten: evt.DestCallerIDNum
                });
            });

            const holdTimeListener = _.debounce(async (evt) => {
                const io = await ctx.api.socket.getIo();
                const t = await ctx.api.scheduler._getRobotToken("", {});
                const user = await ctx.api.users.getUsers(t, { login: evt.DestCallerIDNum });
                if (user) {
                    io.emit(`${user._id}_holdTime`, evt.HoldTime);
                }
            }, 300);

            ami.on("eventAgentConnect", holdTimeListener);

            resolve();
        });
    });

    return { api };
}

api.__generateID = function() {
    return Math.random(new Date().getTime());
}

api.__isOn = async function(t, p) {
    return asteriskON;
}

/** 
 *  @namespace {Object} CallResponse
 *  @property {Number} id
 *  @property {String} status - look at __namespace.js
 */

 /**
  * @param {{ 
  *     phone: String,
  *     gateawayName?: String 
  * }}
  * @return {CallResponse}
  */
api.__call = async function(t, { phone, gateawayName, order }) {
    let id = api.__generateID();
    let isOn = await api.__isOn(t, {});
    if (!isOn) return { id, status: __.CALL_STATUS.ASTERISK_BUSY };

    let gateawayDefault = await api.__getGateawayByDefault(t, { gateawayName });
    let gateaway = await api.__getGateawayByPhone(t, { phone });
    let isAvailable = false;

    gateaway = gateaway || gateawayDefault;

    while (gateaway && !isAvailable) {
        isAvailable = await api.__gateawayIsAvailable(t, { gateaway });
        if (!isAvailable) gateaway = gateaway.next();
    }

    if (!(gateaway && isAvailable)) return { id, status: __.CALL_STATUS.ASTERISK_BUSY };

    let Variable = null;

    if (ctx.cfg.mqtt.textToSpeech) {
        Variable = {
            text1: `Вам пришла посылка из интернет магазина ${order.orderUrl}. Стоимостью ${order.clientFullCost} руб`,
            text2: `Адрес доставки: Город ${order.deliveryAddress.city}, ${order.deliveryAddress.inCityAddress.address}.`,
            text3: `Мы можем доставить посылку ${order.desiredDateDelivery.date} года`
        }

        await Promise.all([
            ctx.api.mqtt.textToSpeech(t, { text: Variable.text1 }),
            ctx.api.mqtt.textToSpeech(t, { text: Variable.text2 }),
            ctx.api.mqtt.textToSpeech(t, { text: Variable.text3 })
        ])
    }

    return new Promise((resolve, reject) => {
        let channel = gateaway.channel.replace(/<phone>/, phone);

        ami.once(id, response => {
            resolve(response);
        });

        ami.action(
            'Originate',
            { 
                Channel: channel, 
                Context: "ringing", 
                Exten: ctx.cfg.ami.exten, 
                Priority: '1',
                Async: true,
                CallerID: phone,
                ActionID: "service_call",
                ChannelId: id,
                Variable
            },
            data => {
                if(data.Response === 'Error'){
                    reject(data);
                }
            }
        );
    });
}

/**
 * @param {{ gateawayName: String }}
 * @return {GateAway}
 */
api.__getGateawayByDefault = async function(t, { gateawayName = "default" }) {
    const gateaway = _.cloneDeep(ctx.cfg.ami.gateaway[gateawayName]);
    if (!gateaway) throw new Error("Alarm! Default GateAway not found " + gateawayName);

    gateaway.next = () => null;
    return gateaway;
}

/**
 * @namespace {Object} GateAway
 * @property {Number} slots
 * @property {String} channel
 * @property {Regex} regex
 * @property {Function} next - return next gateaway by order 1.2.3 etc or null
 */

/**
 * @param {Number} phone
 * @return {GateAway|null}
 */
api.__getGateawayByPhone = async function(t, { phone }) {
    if (!phone) throw new Error("Phone number is required @__getGateawayByPhone");

    let info = rosreestr.getInfoByPhone(phone);
    if (!info) return null;

    let gateawayNum = 1;
    let gateaway = getGateaway();

    return gateaway || null;

    function getGateaway () {
        let name = `${info.operator}${gateawayNum}`;
        let gateaway = ctx.cfg.ami.gateaway[ name ];
        if (!gateaway) return null;

        gateaway = _.cloneDeep(gateaway);
        gateaway.next = () => {
            gateawayNum += 1;
            return getGateaway();
        }

        return gateaway;
    }
}

/**
 * @param {{ gateaway: GateAway }}
 * @return {Boolean}
 */
api.__gateawayIsAvailable = async function(t, { gateaway }) {
    if (!(
        gateaway &&
        gateaway.regex
    )) throw new Error("GateAway is required!");

    return new Promise((resolve, reject) => {

        ami.action(
            "CoreShowChannels",
            {},
            data => {
                let id = data.ActionID;
                let usedSlots = 0;

                if (data.Response === "Error") {
                    reject(data);
                    return
                }

                ami.on("CoreShowChannel" + id, coreShowChannel);
                ami.once("CoreShowChannelsComplete" + id, evt => {
                    ami.off("CoreShowChannel" + id, coreShowChannel);

                    let isActive = usedSlots < gateaway.slots;
                    resolve(isActive);
                });

                function coreShowChannel (evt) {
                    if (gateaway.regex.test(evt.Channel)) {
                        usedSlots++
                    }
                }
            }
        );
    });
}