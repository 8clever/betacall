const fs = require("fs");
const argv = require("yargs").argv;
const _ = require("lodash");

class RosReestr {
    constructor () {
        let csv = fs.readFileSync(__dirname + "/rosreestr.csv").toString();
        this.array = csv.split("\n").map(string => {
            let [ code, from, to, value, operator, region ] = string.split(";");
            return { code, from, to, value, operator, region }
        });
    }

    getInfoByPhone (phone) {
        if (!_.isString(phone)) throw new Error("Phone string is required");
        let code = phone.slice(1, 4);
        let number = phone.slice(4, phone.length);
        let info = _.find(this.array, row => code == row.code && _.inRange(number, row.from, row.to));
        return info;
    }
}

module.exports = RosReestr;


// TEST BLOCK node RosReestr.js --test
if (argv.test) {
    let rosreestr = new RosReestr();
    let info = rosreestr.getInfoByPhone("89066482837");
    if (info.operator !== "Билайн") throw new Error("Invalid rosreestr test!");
    console.log("Test successfully completed!");
}

