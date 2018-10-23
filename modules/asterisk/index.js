const aio = require("asterisk.io");
const __ = require("../api/__namespace");
const _ = require("lodash");

let api = {};
let ami = null;
let ctx = null;
let asteriskON = 1;

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
                if (evt.Event === "PeerStatus") {
                    console.log(evt)
                    asteriskON = evt.PeerStatus === "Registered";
                }

                if (evt.Uniqueid) ami.emit(evt.Uniqueid, evt);
            });
        });
    });

    return { api };
}

api.__isOn = async function(t, p) {
    return asteriskON;
}

api.__call = async function(t, { phone }) {
    return new Promise((resolve, reject) => {
        let id = _.uniqueId("call_");

        ami.on(id, async evt => {
            if (evt.Event === "Hangup") {
                
                // not connecting
                if (evt.ChannelState === "5") {
                    return resolve({ status: __.CALL_STATUS.UNNAVAILABLE });
                }
                
                // connecting
                if (evt.ChannelState === "6") {
                    if (evt.CallerIDNum === evt.ConnectedLineNum) {
                        return resolve({ status: __.CALL_STATUS.UNNAVAILABLE });
                    }
                    /** EMPTY */
                }
            }
    
            if (!(
                evt.Event === 'DialEnd',
                evt.DialStatus === 'ANSWER'
            )) return
            
            let { 
                DestCallerIDNum // user login
            } = evt;

            resolve({ 
                status: __.CALL_STATUS.DONE,
                exten: DestCallerIDNum
            });
        });
    
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
            }
        );
    })
    
}