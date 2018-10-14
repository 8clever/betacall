import queryString from "querystring-es3"
import Actions from "../store/actions.jsx";
import __ from "../../api/__namespace";

export function redirect (prefix, context, target, prm) {
	let _target = prefix + "/" + (target === "index" ? "" : target);
	let query = queryString.stringify(prm);
	let url = `${_target}${query && "?" + query || "" }`;

	if (context && context.res) {
		context.res.redirect(url);
		context.res.end();
		return;
	}
	
	global.router.changeRoute(url);
}

export default (context, target, prm) => {
	if (global.disableRedirects) {
		Actions.showRedirectAlert(_redirect);
		return;
	}
	
	_redirect();

	function _redirect () {
		redirect(__.PREFIX_ADMIN, context, target, prm);
	}
}