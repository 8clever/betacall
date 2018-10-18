const aio = require("asterisk.io");
const __ = require("../api/__namespace");
const _ = require("lodash");

let api = {};
let ami = null;
let ctx = null;

let __queueSize = 0;
let __phonesInQueue = {};
let __ordersCallMem = {};
let m10 = 1000 + 60 * 10;

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
                console.log(evt)
                if (evt.Event === "Hangup") {
                    __queueSize --;
                    delete __phonesInQueue[evt.CallerIDNum];
                }
                if (evt.Uniqueid) ami.emit(evt.Uniqueid, evt);
            });
        });
    });

    return { api };
}

api._startCalls = async function(t, p) {
    let listenersCount = await ctx.api.socket.getListenersCount(t, {});
    let orders = await ctx.api.order.getOrders(t, {});

    for (let order of orders) {
        let orderId = order.orderIdentity.orderId;
        let phone = order.clientInfo.phone;

        if (__queueSize >= ctx.cfg.ami.maxQueue) return;
        if (__queueSize >= (listenersCount + 1)) return;

        if (!__ordersCallMem[orderId] && !__phonesInQueue[phone]) {
            await this._call(t, { phone });
            __ordersCallMem[orderId] = 1;
            setTimeout(() => {
                delete __ordersCallMem[orderId];
            }, m10);
        }
    }
}

api._call = async function(t, {
    phone
}) {
    await ctx.api.users.getCurrentUserPublic(t, {});

    let id = _.uniqueId("call_");
    let io = await ctx.api.socket.getIo(t, {});

    ami.on(id, async evt => {
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
        
        io.emit(user._id, {
            phone: DestConnectedLineNum
        });
    });

    // if (ctx.cfg.ami.sandbox) {
    //     __queueSize++;
    //     ami.emit(id, {
    //         Event: "DialEnd",
    //         DialStatus: "ANSWER",
    //         DestConnectedLineNum: phone,
    //         DestCallerIDNum: "116"
    //     });
    //     return;
    // }

    await new Promise((resolve, reject) => {
        ami.action(
            'Originate',
            { 
                Channel: `SIP/${phone}@voip1`, 
                Context: "ringing", 
                Exten: "333", 
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