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
        });
    });

    return { api };
}

/**
 * @param p.phone
 */
api.call = async function(t, { phone }) {
    let u = await ctx.api.users.getCurrentUserPublic(t, {});

    if (!phone) throw new Error("Invalid phone number");
    if (u.role !== __.ROLES.OPERATOR) throw new Error("Invalid user role");
    
    let exten = u.login;
    let context = ctx.cfg.ami.context;
    let id = `${exten}-${_.uniqueId()}`;
    let io = await ctx.api.socket.getIo(t, {});

    ami.on(id, async evt => {
        let idSocket = `${u._id}-dial-${phone}`;
        io.emit(idSocket, evt);
    });

    ami.action(
        'Originate',
        { 
            Channel: `SIP/${phone}@voip1`, 
            Context: context, 
            Exten: exten, 
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