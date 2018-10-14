import tson from "./tson.jsx";
import { get as getCookie, set as setCookie } from "es-cookie";
import axios from "axios";
import queryString from "querystring-es3";

export default async (...args) => {
    let isServer = !!global.isServer;
    let ctx = isServer ? global : "/restapi/";
    if (isServer) {
        return serverRequest(...args);
    }
    return clientRequest(...args);

    async function clientRequest (...args) {
        var st = getCookie("_t_state") || 1;
        api.invalidate = function () {
            st++; setCookie("_t_state",st,{expired:null,path:"/"});
        };
        
        window.beforeunload = function() {
            setCookie("_t_refresh", window.location.pathname, {
                expired: new Date().valueOf() + 60 * 1000,
                path: "/"
            });
        }
    
        // detection of page refresh
        if (getCookie("_t_refresh") == window.location.pathname) {
            api.invalidate();
        }
    
        return api(...args);

        async function api (f, t, p, o) {
            o = o || {};
            t = t || "public";
            p._t_son = p._t_son || global._t_son;
            
            var _t_jsonq = !!(global._t_jsonq || o._t_jsonq || true);
            var [ apiName, fnName ] = f.split(".");
            
            p._t_st = st;
            
            var data = (p._t_son == 'in' || p._t_son == 'both' ) ? tson.encode(p,true) : p;
            let method = (fnName.search(/(^get)/) == -1) ? "post" : "get"
            let url = ctx + t + "/" + apiName + "/" + fnName;
            let prm = _t_jsonq ? { _t_jsonq: JSON.stringify(data) } : data;
            let response;
            try {
                let axiosPrm = {}
                if (method === "post") {
                    axiosPrm.data = prm;
                } else {
                    url += "?" + queryString.stringify(prm);
                }
                axiosPrm.url = url;
                axiosPrm.method = method;
                response = await axios(axiosPrm);
            } catch (error) {
                if (error.response) {
                    throw error.response.data;
                } else if (error.request) {
                    console.log(error.request);
                }
                throw new Error(error.message);
            }
            if (p._t_son == 'out' || p._t_son == 'both' ) {
                data = tson.decode(response.data);
            }
            return data;
        }
    }

    async function serverRequest (f, t, p, o) {
        o = o || {};
        t = t || "public";
        p._t_son = p._t_son || global._t_son;
        
        let [ apiName, fnName ] = f.split(".");
        let data = await ctx.api[ apiName ][ fnName ](t.valueOf(),p);
        
        if ((global._t_son || p._t_son) && !!data) {
            data = tson.decode(JSON.parse(JSON.stringify(tson.encode(data))));
        }
        
        return data;
    }
}