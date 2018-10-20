const aio = require("asterisk.io");
const __ = require("../api/__namespace");
const _ = require("lodash");
const moment = require("moment");

let api = {};
let ami = null;
let ctx = null;

let __queueSize = 0;
let __phonesInQueue = {};
let __phoneUnnavailable = {};
let __phoneUnnavailabelTimes = {};
let __phoneInOperatorProcess = {};

module.exports.deps = [ "socket", "order" ]
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
            reject(err);
        });

        ami.on('ready', function(){
            resolve();

            ami.on("eventAny", evt => {
                if (evt.Uniqueid) ami.emit(evt.Uniqueid, evt);
            });
        });
    });

    return { api };
}

api._startCalls = async function(t, p) {
    let orders = await ctx.api.order.getOrders(t, {});

    for (let order of orders) {
        let phone = order.clientInfo.phone;
        await this._call(t, { phone });
    }
}

api._phoneLogs = async function() {
    console.log("__phonesInQueue", __phonesInQueue);
    console.log("__phoneUnnavailable", __phoneUnnavailable);
    console.log("__phoneUnnavailabelTimes", __phoneUnnavailabelTimes);
    console.log("__phoneInOperatorProcess", __phoneInOperatorProcess);
}

api._processUnnavailableCalls = async function(t, p) {
    _.each(__phoneUnnavailable, (val, phone) => {
        __phoneUnnavailabelTimes[phone] = __phoneUnnavailabelTimes[phone] || 1;
        __phoneUnnavailabelTimes++;
    });

    await Promise.all(_.map(__phoneUnnavailabelTimes, (times, phone) => {
        return (async () => {
            if (times < 3) return;
            let order = await ctx.api.order.getOrderByPhone(t, { phone });
            await ctx.api.order.replaceCallDate(t, {
                order,
                replaceCallDate: moment().add(1, "day").toDate()
            });
            delete __phoneUnnavailabelTimes[phone];
        })().catch(console.log);
    }));

    __phoneUnnavailable = {};
}

api._call = async function(t, {
    phone
}) {
    let listenersCount = await ctx.api.socket.getListenersCount(t, {});

    if (__queueSize >= ctx.cfg.ami.maxQueue) return;
    if (listenersCount === 0 || __queueSize >= (listenersCount + 1)) return;
    if (__phoneInOperatorProcess[phone]) return;
    if (__phonesInQueue[phone]) return;
    if (__phoneUnnavailable[phone]) return;

    await ctx.api.users.getCurrentUserPublic(t, {});

    let id = _.uniqueId("call_");
    let io = await ctx.api.socket.getIo(t, {});
    let serverIo = await ctx.api.socket.getServerIo(t, {});

    ami.on(id, async evt => {

        if (evt.Event === "Hangup") {
            
            // not connecting
            if (evt.ChannelState === "5") {
                
                if (
                    evt.Cause === "16" || // unnavailable
                    evt.Cause === "34" || // inavlid phone number
                    evt.Cause === "17" // user busy
                ) {
                    __phoneUnnavailable[phone] = 1;
                    clearQueue();
                    return;
                }
            }
            
            // connecting
            if (evt.ChannelState === "6") {
                /** EMPTY */
            }
        }

        if (!(
            evt.Event === 'DialEnd',
            evt.DialStatus === 'ANSWER'
        )) return

        let { 
            DestConnectedLineNum, // phone number
            DestCallerIDNum // user login
        } = evt;

        let user = await ctx.api.users.getUsers(t, {
            query: { login: DestCallerIDNum }
        });

        user = user.list[0];
        if (!user) throw new Error(`User with login extension ${DestCallerIDNum} not found!`);
    
        __phoneInOperatorProcess[phone] = 1;

        let idSocketDone = `${user._id}-${phone}-done`;
        serverIo.once(idSocketDone, () => {
            delete __phoneInOperatorProcess[phone];
        });

        io.emit(user._id, {
            phone: DestConnectedLineNum
        });

        clearQueue();

        function clearQueue () {
            __queueSize --;
            delete __phonesInQueue[evt.CallerIDNum];
        }
    });

    await new Promise((resolve, reject) => {
        ami.action(
            'Originate',
            { 
                Channel: `SIP/${phone}@voip1`, 
                Context: ctx.cfg.ami.context, 
                Exten: ctx.cfg.ami.exten, 
                Priority: '1',
                Async: true,
                CallerID: phone,
                ActionID: "service_call",
                ChannelId: id
            },
            function(data){
                if(data.Response === 'Error'){
                    reject(data);
                }
                __queueSize++;
                __phonesInQueue[phone] = 1;
                resolve();
            }
        );
    })
    
}

/**
 * @param p.phone
 */
api.call = async function(t, { phone }) {
    let u = await ctx.api.users.getCurrentUserPublic(t, {});

    if (!phone) throw new Error("Invalid phone number");
    if (u.role !== __.ROLES.OPERATOR) throw new Error("Invalid user role");
    
    api._call(t, {
        phone
    });
}