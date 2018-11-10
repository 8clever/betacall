import { __, api, token } from "./index.jsx";
import { getCookie, setCookie } from "./cookies.jsx";
import { isString, uniq } from "lodash";
import md5 from "md5";

/**
 * @param context.req
 * @param permission - permission for view page
 * @param rules - actions which we can do on page
 * 
 */
export default async (context, permission, rules = []) => {
    const browserHash = "browser-hash";

    let t = token.get(context);
    let u = await api("users.getCurrentUserPublic", t, {});
    
    // Header links
    let defRules = ([
        __.PERMISSION.USER.VIEW,
        __.PERMISSION.STATS.VIEW,
        __.PERMISSION.SETTINGS.VIEW
    ]).concat(rules);

    if (permission) defRules = defRules.concat([ permission ]);
    defRules = uniq(defRules);

    let actions = defRules.map(rule => {
        if (isString(rule)) return { action: rule };
        return rule;
    });

    let [ security ] = await Promise.all([
        api("obac.getPermissions", t, { rules: actions })
    ]);

    if (permission) {
        if (!(security[permission] && security[permission].global)) {
            let err = new Error("Access denied!");
            err.statusCode = 403;
            throw err;
        }
    }

    u.hash = getCookie(context, browserHash);
    if (!u.hash) {
        u.hash = md5(new Date().toUTCString());
        setCookie(context, browserHash, u.hash, { path: '/' });
    }

    u.security = security;
    return u;
}