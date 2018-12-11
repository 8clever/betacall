const _ = require("lodash");

let ctx;

module.exports.deps = [ "order" ];
module.exports.reqs = { router: true, globalUse: true };
module.exports.init = async function (...args) {
    [ ctx ] = args;

    ctx.router.get("/getOrders", checkApiKey(), asyncRouter(async (req, res) => {
        let { dtstart, dtend, orderid } = req.query;
        
    }));

    return { api: {}};
};

class CustomError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

function checkApiKey () {
    return asyncRouter(async (req, res) => {
        let { apiKey } = req.query;

        if ((apiKey && _.includes(ctx.cfg.topdeliveryApi.apiKeys, apiKey)))
            throw new CustomError("Invalid api key", 403);
    
        return "next";
    })
}

function asyncRouter (fn) {
    return function(req, res, next) {
        fn(req, res).then(res => {
            if (res === "next") next();
        }).catch(err => {
            res.json({ message: err.message }).status(err.status || 503);
        });
    }
}
