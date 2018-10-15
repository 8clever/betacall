
let api = {};
let mysql = require("mysql");
let connection = null;
let ctx = null;

module.exports.init = async function(...args) {
    [ctx] = args;    
    connection = mysql.createConnection(ctx.cfg.mysql.main);

    await new Promise((resolve, reject) => {
        connection.connect(err => {
            if (err) reject(err);
            resolve();
        });
    });
    
    return { api }
}

api.getConnection = async function(t, p) {
    return connection;
}