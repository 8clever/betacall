let api = {};
let io = null;

module.exports.init = async function() {
    return { api };
}

const EventEmitter = require('events');
class ServerIo extends EventEmitter {}

let __listenersCount = 0;
let __serverIo = new ServerIo();

api.init = async function (t, http) {
    io = require("socket.io")(http);

    io.on("connection", function(client) {
        console.log("socket-client connected");
        __listenersCount++;

        client.on("msg", (data) => {
            if (data.evtid) {
                __serverIo.emit(data.evtid, data);
            }
        });

        client.on('disconnect', function () {
            console.log('socket-client disconnected');
            __listenersCount--;
        });
    });
}

api.getIo = async function(t, p) {
    return io;
}

api.getServerIo = async function(t, p) {
    return __serverIo;
}

api.getListenersCount = async function(t, p) {
    return __listenersCount;
}