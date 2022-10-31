const Asterisk = require("../modules/asterisk");
const Tinyback = require("tinyback");
let ctx = {};

run().then(() => {
    console.log("done!");
    process.exit(0)
}).catch(err => {
    console.log(err);
    process.exit(1);
});

async function run () {
    ctx.cfg = await Tinyback.readConfig();
    ctx.asterisk = await Asterisk.init(ctx);

    let response = await ctx.asterisk.api.__gateawayIsAvailable(null, { gateaway: ctx.cfg.ami.gateaway.default });
    console.log(response);
}