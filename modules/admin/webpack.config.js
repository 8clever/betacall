
const path = require('path');
const StringReplacePlugin = require("string-replace-webpack-plugin");
const localizationPath = path.resolve(__dirname, "./dist/localization.json");
const fs = require("fs");
const __ = require("../api/__namespace");
const WebpackBundleSizeAnalyzerPlugin = require('webpack-bundle-size-analyzer').WebpackBundleSizeAnalyzerPlugin;
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const smp = new SpeedMeasurePlugin();

const jsxLoader = {
    test: /\.jsx$|__namespace\.js$/,
    exclude: /node_modules\//,
    use: [
        {
            loader: "babel-loader"
        }
    ]
}

let config = {
    context: __dirname,
    mode: "production",
    module: {
        rules: [
            jsxLoader
        ]
    },
    entry: [
        './pages/_app.jsx'
    ],
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: __.PREFIX_ADMIN + "/"
    },
    plugins: [
        new WebpackBundleSizeAnalyzerPlugin('../../../report-admin.txt')
    ]
}

let isRequiredI18n = false;
let localization = {};
if (!fs.existsSync(localizationPath)) {
    isRequiredI18n = true;
    fs.writeFileSync(localizationPath, JSON.stringify({}));
}

if (isRequiredI18n) {
    jsxLoader.use.push({
        loader: StringReplacePlugin.replace({

            // internalization, generate localization.json
            // from current project
            replacements: [
                {
                    pattern: /i18n.t\(['"`]([\w ./,-?!]*?)['"`]\)/ig,
                    replacement: function (match, p1, offset, string) {
                        if (localization[p1]) return match;
                        localization[p1] = p1;
                        fs.writeFileSync(localizationPath, JSON.stringify(localization));
                        return match;
                    }
                }
            ]
        })
    });
    config.plugins.push(new StringReplacePlugin());
}

module.exports = smp.wrap(config);