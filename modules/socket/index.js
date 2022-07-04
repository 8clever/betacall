const parser = require("cookie");

let api = {};
let io = null;
let ctx = null;

module.exports.init = async function (_ctx) {
	ctx = _ctx;
	return {
		api
	}
}

const EventEmitter = require('events');

class ServerIo extends EventEmitter { }

let __serverIo = new ServerIo();

api.init = async function (t, http) {
	io = require("socket.io")(http);

	io.use(async (client, next) => {
		try {
			const { token } = parser.parse(client.handshake.headers.cookie || "");
			await ctx.api.users.getCurrentUser(token);
			next();
		} catch (e) {
			next(e)
		}
	});

	io.on("connection", async function (client) {
		console.log("socket-client connected: " + io.engine.clientsCount);

		client.on("msg", (data) => {
			if (data.evtid) {
				__serverIo.emit(data.evtid, data);
			}
		});

		client.on('disconnect', function () {
			console.log('socket-client disconnected');
		});

	});
}

api.closeConnections = async function (t, p) {
	io.disconnectSockets(true);
}

api.getIo = async function (t, p) {
	return io;
}

api.getServerIo = async function (t, p) {
	return __serverIo;
}

api.getListenersCount = async function (t, p) {
	const cfg = await ctx.api.settings.getSettings(t);
	let count = io.engine.clientsCount;
	if (cfg.robots.start) {
		count += cfg.robots._i_count;
	}
	return count;
}