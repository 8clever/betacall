const _ = require("lodash");
const aio = require("asterisk.io");

let config = _.merge(require("./config"), require("./local-config"));
let ami = aio.ami(
    config.ami.host,
    config.ami.port,
    config.ami.username,
    config.ami.password
);

ami.on('error', function(err){
    throw err;
});
 
ami.on('ready', function(){
    console.log(`Cennected to ${config.ami.host}`);
    // connected && authenticated

    let phoneNum = "89537471001";
    let exten = "100";
    let context = "call-out";

    ami.action(
        'Originate',
        { 
            Channel: `SIP/${phoneNum}@voip1`, 
            Context: context, 
            Exten: exten, 
            Priority: '1',
            Async: true,
            callerID: phoneNum,
            ActionID: "Originate Call"
        },
        function(data){
            if(data.Response == 'Error'){
                console.log('Originate', data);
                return;
            }
            console.log('Originate', data.Message);
        }
    );

    // ami.action(
    //     "Command",
    //     {
    //         Command: `channel originate SIP/103 extension 89066482837@call-out`
    //     },
    //     function(data){
    //         if(data.Response == 'Error'){
    //             console.log('Command', data);
    //             return;
    //         }
    //         console.log('Command', data);
    //     }
    // )
    
    // ami.action(
    //     "Command",
    //     {
    //         Command: `sip/103 dial 89066482837@call-out1`
    //     },
    //     function(data){
    //         if(data.Response == 'Error'){
    //             console.log('Command', data);
    //             return;
    //         }
    //         console.log('Command', data);
    //     }
    // )

    ami.on('eventAny', function(data){
        console.log(data)
    });
});

