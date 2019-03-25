const argv = require("yargs").argv
const RosReestr = require("../modules/asterisk/RosReestr");
const rosreestr = new RosReestr();

let info = getInfo();
console.dir(info, { depth: null });

function getInfo () {
    if (!argv.phone) {
        return "--phone=NUMBER is required";
    }
    
    return rosreestr.getInfoByPhone(argv.phone.toString());
}