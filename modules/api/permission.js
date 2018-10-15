const __ = require("./__namespace");

let api = {};
let ctx = null;

module.exports.deps = ['obac'];
module.exports.init = async function (...args) {
	[ ctx ] = args;

    let prms = [
        { prm: __.PERMISSION.USER.EDIT, api: "users", fn: "permUserEdit" },
        { prm: __.PERMISSION.USER.VIEW, api: "users", fn: "permUserView" },

        { prm: __.PERMISSION.ORDER.VIEW, api: "order" },
        { prm: __.PERMISSION.ORDER.EDIT, api: "order" }
    ]
    
    await Promise.all(prms.map(p => {
        return ctx.api.obac.register([p.prm], p.api, { permission: p.fn || p.prm });
    }));

    return { api };
};

/**
 * 
 * @param {*} t 
 * @param {*} p.perm 
 * @param {*} p.addData
 * 
 */
api.check = async function(t, { perm, addData = {}}) {
    if (!perm) throw new Error("Invalid permission");
    let prm = Object.assign({
        action: perm,
        throw: true
    }, addData);

    return ctx.api.obac.getPermission(t, prm);
}
