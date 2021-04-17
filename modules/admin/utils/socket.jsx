import io from "socket.io-client";
class Socket {
	static connect() {
		if (!global.isBrowser) return;

		let socket = io();
		socket.on('connect', () => {
			console.log("socket-client connected");
		});

		socket.on('disconnect', err => {
			console.log(err);
			socket.connect();
		});

		return socket;
	}
}

export default Socket