import { isFinite } from "lodash";

/**
 * @param value - our value from input
 * @param options
 * @param options.isNumber
 * @param options.minValue
 * @param options.maxValue
 * @param options.toFixed
 */
export default (value, options = {}) => {
    value = value || "";

    if (options.isNumber) {
        let regex = "(-|)(0|[0-9]*)";
        if (options.toFixed) {
            options.toFixed = options.toFixed || 2;
            let n = 0;
            let rgx = "";
            while (n <= options.toFixed) {
                rgx = `${regex}[,.][0-9]{${n}}${rgx ? "|" + rgx : ""}`;
                n++;
            }
            regex = rgx + "|" + regex;
        }
        
        let match = value.match(new RegExp(regex));
        value = match && match[0] || "";

        if (isFinite(options.minValue) && parseFloat(value) < options.minValue) {
            value = options.minValue;
        }
        if (isFinite(options.maxValue) && parseFloat(value) > options.maxValue) {
            value = options.maxValue;
        }
    }
    
    return value;
}