const fs = require("fs");
const argv = require("yargs").argv;
const _ = require("lodash");

/**
 * @constructor
 */
class RosReestr {
    constructor () {
        let csv = fs.readFileSync(__dirname + "/rosreestr.csv").toString();
        this.memo = csv.split("\n").reduce((memo, string) => {
            let [ code, from, to, value, operator, region ] = string.split(";");
            
            /**
             * @namespace {Object} RosReestrInfo
             * @property {String} code XXX
             * @property {Number} from XXXXXXX
             * @property {Number} to XXXXXXX
             * @property {String} operator Билайн MTC etc
             * @property {String} region Московская область etc
             * @property {String} value XXXX
            */
            let info = {
                from: parseInt(from),
                to: parseInt(to),
                code,
                operator,
                value,
                region
            }

            memo[ code ] = memo[ code ] || [];
            memo[ code ].push(info);

            return memo;
        }, {});
    }

    /**
     * 
     * @param {String} phone - phone number XXXXXXXX
     * @return {RosReestrInfo|null}
     */
    getInfoByPhone (phone) {
        if (!_.isString(phone)) throw new Error("Phone string is required");
        let code = phone.slice(1, 4);
        let number = parseInt(phone.slice(4, phone.length));

        let infos = this.memo[ code ];
        if (!infos) return null;

        let info = infos.find(info => _.inRange(number, info.from, info.to + 1));
        return info || null;
    }
}

module.exports = RosReestr;

/**
 *  TEST BLOCK
 *  node modules/asterisk/RosReestr.js --test
 * 
 *  full array search speed 40 ms
 *  search by codes first 0.8 ms
 * 
 */
if (argv.test) {
    let rosreestr = new RosReestr();
    let label = "Reestr speed";
    let checkOperator = (phone, expectedOperator) => {
        let info = rosreestr.getInfoByPhone(phone);
        if (info.operator !== expectedOperator) throw new Error(`${phone} expected: ${expectedOperator} actual: ${info.operator}`);
    }

    console.time(label);
    checkOperator("89066482837", "Билайн");
    checkOperator("89268838425", "Мегафон");
    checkOperator("89537471001", "Теле2");
    console.timeEnd(label);
}

