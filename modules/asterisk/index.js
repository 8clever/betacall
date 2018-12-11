const aio = require("asterisk.io");
const __ = require("../api/__namespace");

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
                    asteriskON = evt.PeerStatus === "Registered";
                }

                if (evt.Uniqueid) {

                    // end dial
                    if (evt.Event === "Hangup") {
                        if (
                            evt.Cause === "1" ||
                            evt.Cause === "16" ||
                            evt.Cause === "17" ||
                            evt.Cause === "20" ||
                            evt.Cause === "21" ||
                            evt.Cause === "34"
                        ) {
                            ami.emit(evt.Uniqueid, { 
                                status: __.CALL_STATUS.UNNAVAILABLE,
                                id: evt.Uniqueid
                            });
                        } else {
                            console.log(evt.Cause, evt["Cause-txt"]);
                            ami.emit(evt.Uniqueid, { 
                                status: __.CALL_STATUS.CONNECTING_PROBLEM ,
                                id: evt.Uniqueid
                            });
                        }
                    }
                    
                    // connect with operator
                    if (evt.Event === 'DialEnd' && evt.DialStatus === 'ANSWER') {
                        ami.emit(evt.Uniqueid, {
                            id: evt.Uniqueid,
                            status: __.CALL_STATUS.DONE,
                            exten: evt.DestCallerIDNum
                        });
                    }
                }
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
        let id = Math.random(new Date().getTime());

        ami.once(id, response => {
            resolve(response);
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