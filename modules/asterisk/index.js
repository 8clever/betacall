const aio = require("asterisk.io");
const __ = require("../api/__namespace");

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
    
    return new Promise((resolve, reject) => {
        ami.action(
            'Originate',
            { 
                Channel: `SIP/${phone}@voip1`, 
                Context: context, 
                Exten: exten, 
                Priority: '1',
                Async: true,
                callerID: phone,
                ActionID: "service_call"
            },
            function(data){
                if(data.Response === 'Error'){
                    return reject(data);
                }

                resolve();
            }
        );
    });
}



