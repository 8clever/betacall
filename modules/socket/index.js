let api = {};
let io = null;

module.exports.init = async function() {
    return { api };
}

api.init = async function (t, http) {
    io = require("socket.io")(http);

    io.on("connection", function() {
        console.log("socket-client connected");
    });
}

api.getIo = async function(t, p) {
    return io;
}