import { set, get } from "es-cookie"
import parser from "cookie";

export function setCookie (ctx, name, value, options) {
    if (global.isServer && ctx && ctx.res) {
        ctx.res.cookie(name, value, options);
        return;
    }

    set(name, value, options);
}

export function getCookie (ctx, name) {
    if (global.isServer && ctx && ctx.req) {
        let cookies = ctx.req.headers.cookie;
		if (!cookies) return null;
        cookies = parser.parse(cookies);
		return cookies[name];
    }
    
	let cookie = get(name);
	return cookie;
}