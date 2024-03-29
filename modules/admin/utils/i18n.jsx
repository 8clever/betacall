import __ from "../../api/__namespace";
import _ from "lodash";

export class I18n_source {
    constructor(user = {}) {
        user.lang = user.lang || __.LANG_DEF;
        this.user = user;
        this.lang = user.lang;
        this.path = user.lang === __.LANG_DEF ? "" : "_" + user.lang;
        
        /** should be extend from child */
        this.localization = {} 
    }

    t (orig) {
        if (!this.localization[orig]) {
            console.log("localization not exists:", orig);
            return orig;
        }
        return this.localization[orig];
    }
}

export class I18n extends I18n_source {
    constructor (props) {
        super(props);
        this.localization = require(`../dist/localization${this.path}.json`);

        try {
            let localizationCustom = require(`../dist/localization_custom${this.path}.json`);
            this.localization = _.merge({}, this.localization, localizationCustom);
        } catch (err) {console.log(err)}
    }
}

export default I18n;