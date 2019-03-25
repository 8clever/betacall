const argv = require("yargs").argv
const RosReestr = require("../modules/asterisk/RosReestr");
const rosreestr = new RosReestr();

getInfo();

function getInfo () {
    if (!argv.phone) {
        console.log("--phone=NUMBER is required")
        return;
    }
    
    let info = rosreestr.getInfoByPhone(argv.phone.toString());
    console.dir(info, { depth: null });
}