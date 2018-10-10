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
    console.log(`Cennected to ${config.api.host}`);
    // connected && authenticated
 
});
