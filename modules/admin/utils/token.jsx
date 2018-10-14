import { getCookie, setCookie } from "./cookies.jsx";
let PUBLIC = "public";

function get (ctx) {
	return getCookie(ctx, "token");
}

function set (token) {
	let expDate = new Date();
	expDate.setTime(expDate.getTime() + (5 * 24 * 60 * 60 * 1000));
	setCookie(null, "token", token, { 
		path: "/", 
		expires: expDate
	});
}

function rm () {
	setCookie(null, "token", PUBLIC, { path: "/" });
}

export default { 
	get,
	set,
	rm
}