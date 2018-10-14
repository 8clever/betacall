import __ from "../../api/__namespace";

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
    }
}

export default I18n;