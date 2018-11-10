
var reactExpressMiddleware = require('react-express-middleware');
var safe = require('safe');
var qs = require("querystring-es3");
var __ = require("../api/__namespace");

module.exports = function (router) {
    router.use(reactExpressMiddleware());
    router.use(parseQuery);
    router.get('/', promiseRouter(require('./pages/index.jsx')));
    router.get("/signin", promiseRouter(require("./pages/signin.jsx")));
    router.get("/users", promiseRouter(require("./pages/users.jsx")));
    router.get("/stats", promiseRouter(require("./pages/stats.jsx")));
    router.get("/settings", promiseRouter(require("./pages/settings.jsx")));
    router.get("/redirect", promiseRouter(require("./pages/redirect.jsx")));
    
    // err handler
    router.use(require("./pages/_error.jsx").default);
};

function promiseRouter(module) {
    return async function(req, res, next) {
        var Actions = require("./store/actions.jsx");
        Actions.default.loading();
        res.locals.prefix = __.PREFIX_ADMIN;
        res.locals.prefixWidget = __.PREFIX_WIDGET;
        res._render = async function(Component, store) {
            let txt = await new Promise((resolve, reject) => {
                res.renderReactComponent(Component, store, safe.sure(reject, resolve));
            });
            res.send(txt);
            res.end();
            Actions.default.stopLoading();
        }

        try {
            await module.default({ req, res });
        } catch(err) {
            next(err);
        }
    }
}

function parseQuery (req, res, next) {
    let queryString = req.originalUrl.split("?")[1] || "";
    req.query = qs.parse(queryString) || {};
    next();
}