const amiInit = require("./ami");
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
    
    ami = amiInit(
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
                
                /** DONE ORDER */
                if (evt.Cause === "777") {
                    ami.emit(evt.Uniqueid, { 
                        status: __.CALL_STATUS.DONE_ORDER,
                        id: evt.Uniqueid
                    });
                    return;
                }

                /** RECALL LATER */
                if (evt.Cause === "778") {
                    ami.emit(evt.Uniqueid, { 
                        status: __.CALL_STATUS.RECALL_LATER,
                        id: evt.Uniqueid
                    });
                    return;
                }

                if (
                    evt.Cause === "0" ||
                    evt.Cause === "1" ||
                    evt.Cause === "16" ||
                    evt.Cause === "17" ||
                    evt.Cause === "18" ||
                    evt.Cause === "19" ||
                    evt.Cause === "20" ||
                    evt.Cause === "21" ||
                    evt.Cause === "22" ||
                    evt.Cause === "34" ||
                    evt.Cause === "38" ||
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
api.__call = async function(t, { phone, gateawayName, texts = [], vars = {} }) {
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

    const Variable = [];

    const makeVar = (key, val) => {
        Variable.push(`${key}="${val}"`);
    }

    let n = 1;
    for (const text of texts) {
        await ctx.api.mqtt.textToSpeech(t, { text });
        makeVar(`text${n}`, text);
        n += 1;
    }

    for (const key of Object.keys(vars)) {
        makeVar(key, vars[key]);
    }

    return new Promise((resolve, reject) => {
        const { context = "ringing" } = gateaway;
        const channel = gateaway.channel.replace(/<phone>/, phone);

        ami.once(id, response => {
            resolve(response);
        });

        ami.action(
            'Originate',
            { 
                Channel: channel, 
                Context: context, 
                Exten: ctx.cfg.ami.exten, 
                Priority: '1',
                Async: true,
                CallerID: phone,
                ActionID: "service_call",
                ChannelId: id,
                Timeout: ctx.cfg.ami.timeout,
                Variable: Variable.join(",")
            },
            data => {
                if(data.Response === 'Error'){
                    reject(data);
                }
            }
        );
    });
}

api.__releaseCall = async (t, { callId }) => {
    ami.emit(callId, { 
        status: __.CALL_STATUS.MANUAL_RELEASE,
        id: callId
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

        ami.action("Command", {
            Command: "sip show channels"
        }, data => {
            const  [ ,domain ] = gateaway.channel.split("@")
            const raw = data.raw;
            const lines = raw.split("\n");

            let awailSlots = gateaway.slots;

            for (const line of lines) {
                if (
                    line.includes("Output") && 
                    line.includes(domain) && 
                    !line.includes("BYE")
                ) {
                    awailSlots--;    
                }
            }

            resolve(awailSlots > 0)
        })
    });
}