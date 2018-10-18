let api = {};
let io = null;

module.exports.init = async function() {
    return { api };
}

let __listenersCount = 0;

api.init = async function (t, http) {
    io = require("socket.io")(http);

    io.on("connection", function(client) {
        console.log("socket-client connected");
        __listenersCount++;

        client.on('disconnect', function () {
            console.log('socket-client disconnected');
            __listenersCount--;
        });
    });
}

api.getIo = async function(t, p) {
    return io;
}

api.getListenersCount = async function(t, p) {
    return __listenersCount;
}