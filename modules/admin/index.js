const routes = require("./routes");
const webpackConfig = require("./webpack.config");
const express = require("express");
const path = require("path");
const sassMiddleware = require("node-sass-middleware");
const distPath = path.join(__dirname, "./dist");
const __ = require("../api/__namespace");
const ejs = require('consolidate').ejs;
const DEV = "development";
const webpack = require("webpack");

module.exports.reqs = { router: true, globalUse: true };
module.exports.init = async function (ctx) {
    let { router, api, cfg } = ctx;
    let { env } = cfg; 

    global._t_son = "out";
    global.api = api;
    global.isServer = true;

    let Router = express();

    Router.engine('html', ejs);
    Router.set('view engine', 'html');
    Router.set('views', webpackConfig.output.path);

    if (env === DEV) {
        webpackConfig.mode = DEV;
        webpackConfig.plugins = webpackConfig.plugins || [];
        webpackConfig.plugins.push(
            new webpack.HotModuleReplacementPlugin(),
            new webpack.NoEmitOnErrorsPlugin()
        );

        webpackConfig.entry.unshift(`webpack-hot-middleware/client?path=${__.PREFIX_ADMIN}/__webpack_hmr&timeout=20000`);
        webpackConfig.devtool = '#source-map';
        const compiler = webpack(webpackConfig);

        Router.use(require("webpack-dev-middleware")(compiler, {
            logLevel: 'warn',
            publicPath: "/"
        }));

        Router.use(require("webpack-hot-middleware")(compiler, {
            log: console.log, path: `/__webpack_hmr`, heartbeat: 10 * 1000
        }));
    }

    routes(Router);

    Router.use(sassMiddleware({
        src: path.join(__dirname, "./style"),
        dest: distPath,
        outputStyle: 'compressed'
    }));

    Router.use(express.static(distPath));
    router.use(Router);
    return { api: {}};
};
