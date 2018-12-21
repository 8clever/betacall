let api = {};
let mysql = require("mysql");
let pool = null;
let ctx = null;

module.exports.init = async function(...args) {
    [ctx] = args;
    pool = mysql.createPool(ctx.cfg.mysql.main);
    return { api }
}

api.getConnection = async function(t, p) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) return reject(err);
            resolve(connection);
        })
    })
}