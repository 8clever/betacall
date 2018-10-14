const tinyback = require('tinyback');
let ctx = { api: {}};
let cols = {}; 
let db;

module.exports.init = async () => {
    ctx.cfg = await tinyback.readConfig();

    await (async () => {
        let m = await tinyback.prefixify().init(ctx);
        ctx.api.prefixify = m.api;
    })();

    await (async () => {
        let m = await tinyback.mongodb().init(ctx);
        ctx.api.mongo = m.api;
    })();

    db = await ctx.api.mongo.getDb({});

    return {
        ctx,
        cols,
        db
    }
}


