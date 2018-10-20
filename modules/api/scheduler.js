var safe = require('safe');
var moment = require('moment');
var colors = require('colors');
var cronJob = require('cron').CronJob;
const _ = require("lodash");

var api = {};
var ctx;

module.exports.deps = [ "users", "order" ];
module.exports.init = async function (_ctx) {
	ctx = _ctx;

	// WRITE SCHEDULES HERE
	api.addJob("email.sendAllMessages", { cronTime: ctx.cfg.email.period });
	api.addJob("order._getCallOrders", { cronTime: "0 */15 * * * *" });
	api.addJob("asterisk._startCalls", { cronTime: "*/10 * * * * *" });
	api.addJob("asterisk._processUnnavailableCalls", { cronTime: "0 0 */1 * * *" });

	return { api };
};

var lastDate = null;
function _appError(err, name) {
	if (err) {
		if (ctx.locals.newrelic)
			ctx.locals.newrelic.noticeError(err);

		if (!lastDate || lastDate !== moment().format('YYYY-MM-DD')) {
			lastDate = moment().format('YYYY-MM-DD');
			console.log(('--------- ' + lastDate + ' ---------').bold);
		}

		if (name)
			console.log(moment().format('HH:mm:ss'), name, colors.red(err.message || err));
		else
			console.log(moment().format('HH:mm:ss'), colors.red(err.message || err));
	}
}

function _appLog(name, time) {
	if (time < 1500)
		time = time.toString();
	else if (time < 3000)
		time = time.toString().yellow;
	else
		time = time.toString().red;

	if (!lastDate || lastDate !== moment().format('YYYY-MM-DD')) {
		lastDate = moment().format('YYYY-MM-DD');
		console.log(('--------- ' + lastDate + ' ---------').bold);
	}

	console.log(moment().format('HH:mm:ss'), name.green, time + 'ms');
}

var queue = safe.queue(function(task, cb) {
	var fn = function() {
		if (ctx.locals.newrelic) {
			var _cb = cb;
			cb = function() {
				ctx.locals.newrelic.endTransaction();
				_cb.apply(this, arguments);
			};
		}

		var startTime = Date.now();
		var timer = setTimeout(function() {
			var fn = cb;
			cb = null;
			_appError(new Error("Warning! '" + task.name + "' not respond more than two minutes!"), task.name);
			fn();
		}, 120000);

		task.cmd(function(err, arg) {
			clearTimeout(timer);
			if (err)
				_appError(err, task.name);
			else if (arg != 'ofttimes')
				_appLog(task.name, Date.now() - startTime);

			if (cb)
				cb();
		});
	};

	if (ctx.locals.newrelic)
		fn = ctx.locals.newrelic.createBackgroundTransaction(task.name, fn);

	fn.apply(this, arguments);
}, 1);

api._getRobotToken = async function (t, notRequired) {
	let now = new Date();
	let user = await ctx.api.users.getUsers(t, {
		query: { 
			_b_scheduler: 1
		},
		fields: { 
			"tokens.token": 1,
			"tokens._dtexp": 1
		}
	});
	if (!user.count) throw new Error("Robot not found!");
	let { token } = _.find((user.list[0].tokens || []), t => t.token && moment(now).isBefore(t._dtexp)) || {};
	if (token) return token;
	token = await ctx.api.users._generateToken(t, {});
	await ctx.api.users._updateUserToken(t, {
		token,
		_iduser: user.list[0]._id
	});
	return token;
}

/**
 * @param name
 * @param cronTime
 */
api.addJob = function(name, { cronTime }){
	var job = new cronJob(cronTime, safe.sure(_appError, () => {
		queue.push({
			cmd: cb => {
				this._getRobotToken("", {}).then(token => {
					let [module, api] = name.split(".");
					ctx.api[module][api](token, {}).then(() => {
						cb();
					});
				}).catch(cb);
			},
			name: name
		});
	}));
	job.start();
}
