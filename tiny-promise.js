const _ = require("lodash");
const isAsync = (f) => {
	return f.constructor.name === 'AsyncFunction';
};

module.exports = function(app, newrelic) {
	const createTracer = newrelic ?
		(tr, fn) => newrelic.createTracer(tr, fn) :
		(tr, fn) => fn;

	_.each(app.api, function (module, ns) {
		_.each(module, function (fn, name) {
			if (!_.isFunction(fn))
				return;

			const _isAsync = isAsync(fn);
			const tr = `api/api/${ns}/${name}`;

			if (!_isAsync) return;

			module[name] = async function (...args) {
				let tracer = createTracer(tr, () => { });

				try {
					let result = await Reflect.apply(fn, this, args);
					tracer(null, result);
					return result;
				} catch (err) {
					if (newrelic && err) {
						newrelic.noticeError(err);
					}

					tracer(err);
					throw err;
				}
			};
		});
	});
};
