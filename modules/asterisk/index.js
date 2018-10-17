const aio = require("asterisk.io");
const __ = require("../api/__namespace");
const _ = require("lodash");

let api = {};
let ami = null;
let ctx = null;

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

            setTimeout(() => {
                api._call("", {
                    phone: "89537471001"
                })
            }, 5000)
            
        });
    });

    return { api };
}

api._call = async function(t, {
    phone
}) {
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
                throw data;
            }
        }
    );
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