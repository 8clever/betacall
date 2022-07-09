var _ = require("lodash");
var safe = require("safe");
var path = require("path");
var express = require('express');
var moment = require('moment');
var bodyParser = require('body-parser');
var multer = require('multer');
var lxval = require('lx-valid');
var crypto = require('crypto');
var Hook = require('tinyhook').Hook;
var http = require('http');
var compression = require("compression");

var CustomError = module.exports.CustomError = function (message, subject) {
	this.constructor.prototype.__proto__ = Error.prototype;
	Error.captureStackTrace(this, this.constructor);
	this.name = "CustomError";
	this.message = message;
	this.subject = subject;
};

/**
 * @property {Object} invalid validation result object
 * @type {Function}
 */
var ValidationError = module.exports.ValidationError = function (invalid) {
	this.constructor.prototype.__proto__ = Error.prototype;
	var es = "Validation fails: ";

	_.each(invalid.errors, function (error) {
		es += error.property + " " + error.message + " ";
		if (error.expected)
			es += ", expected	" + JSON.stringify(error.expected);
		if (error.actual)
			es += ", actual " + JSON.stringify(error.actual);
		es += "; ";
	});

	this.name = 'ValidationError';
	this.message = es;
	this.subject = 'Invalid Data';
	this.data = _.reduce(invalid.errors, function (m, f) {
		m.push(_.pick(f, ['property', 'message']));
		return m;
	}, []);
};

module.exports.createApp = async function (cfg) {
	// inject some modules for internal use if not requested
	var hasRegistry = false;
	_.each(cfg.modules, function (module) {
		if (module.name == "_t_registry")
			hasRegistry = true;
	});
	if (!hasRegistry)
		cfg.modules.unshift({ target: "root", name: "_t_registry", object: _t_registry() });

	// create express app (might need to create it on demand ?)
	var app = express();

	if (cfg.config.env === "production") {
		app.use(compression());
	}
	app.use(function (req, res, next) {
		req.setMaxListeners(20);
		next();
	});

	function instrumentExpress(app) {
		app.use(require("express-promise")());
		app.use(bodyParser.json({ limit: cfg.config.app.postLimit || "20mb" }));
		app.use(bodyParser.text({ limit: cfg.config.app.postLimit || "20mb" }));
		app.use(bodyParser.raw({ limit: cfg.config.app.postLimit || "50mb" })); // to parse getsentry "application/octet-stream" requests
		app.use(bodyParser.urlencoded({ extended: true, limit: cfg.config.app.postLimit || "20mb" }));
		app.use(multer({ dest: '/tmp' }).any());
	}

	var api = {};
	var locals = {};
	var auto = {};
	var registered = {};
	var requested = {};
	var lmodules = {};
	var proxy = null; // proxy might be required for multinode

	var nodes = {};
	var thisNode = "root";

	var hook = new Hook({
		name: thisNode,
		port: cfg.hookPort
	});
	hook.start();

    return new Promise((resolve, reject) => {
		hook.once("hook::ready", function () {
			// lets check if we was launched as tiny back node
			_.each(process.argv, function (param) {
				var match = /--tinybacknode=(.*)/.exec(param);
				if (match) {
					var params = JSON.parse(match[1]);
					thisNode = params.target;
					nodes = params.nodes;
					// when running as node we need to listen on random port
					// and announce it
					var httpServer = http.createServer(app);
					httpServer.listen(0, function () {
						var port = httpServer.address().port;
						hook.emit("tinyback::targetproxy::" + thisNode, { port: port });
						hook.on("*::tinyback::wanttargetproxy::" + thisNode, function (target) {
							hook.emit("tinyback::targetproxy::" + thisNode, { port: port });
						});
					})
				}
			})

			hook.on("*::tinyback::wantmoduleproxy", function (mname) {
				if (api[mname]) {
					hook.emit("tinyback::moduleschema::" + mname, _.keys(api[mname]));
				}
			});

			var cbs = {};
			var i = 0;
			hook.on("*::tinyback::reply::" + thisNode, function (reply) {
				var cb = cbs[reply.rn];
				if (cb) {
					delete cbs[reply.rn];
					var err = null;
					if (reply.err) {
						if (reply.err.name == "CustomError" || reply.err.subject) {
							err = new CustomError(reply.err.message, reply.err.subject)
						}
						else
							err = new Error(reply.err);
					}
					cb(err, reply.res);
				}
			});

			_.each(cfg.modules, module => {
				registered[module.name] = 1;
				var mod = module.object || null;
				if (module.require) {
					var mpath = module.require;
					if (mpath.charAt(0) == ".")
						mpath = path.resolve(path.dirname(require.main.filename), mpath);
					mod = require(mpath);
				}
				if (!mod)
					throw new Error("Can't not load module " + module.name);
				// setting default value
				module.target = module.target || mod.target;
				if (!module.target || cfg.forceRootTarget)
					module.target = "root";
				// checkinng if this module is local to this node or not
				var local = module.target == "local" || module.target == thisNode;
				var args = _.clone(module.deps || []);
				args = _.union(mod.deps || [], args);
				_.each(args, function (m) {
					requested[m] = 1;
				});

				var reqs = _.defaults(mod.reqs || {}, ((cfg.defaults || {}).module || {}).reqs || {}, { router: false, globalUse: false });
				args.push(function (cb) {
					var router = null;
					if (reqs.router) {
						router = express.Router();
						app.use("/" + module.name, router);
					}
					var dt = new Date();
					if (local) {
						if (router && reqs.globalUse) {
							instrumentExpress(router);
						}

						let p = mod.init({
							target: thisNode,
							api: api,
							locals: locals,
							cfg: cfg.config,
							defs: (cfg.defaults || {}),
							app: this,
							router: router
						});

						if (!p.then) {
							throw new Error("Init is not a Promise: " + module.name);
						}

						p.then(mobj => {
							if (!(module.target == 'local' && thisNode != 'root'))
								console.log(thisNode + " loaded " + module.name + " in " + ((new Date()).valueOf() - dt.valueOf()) / 1000.0 + " s");
							
							var lapi = api[module.name] = mobj.api;
							lmodules[module.name] = 1;
							hook.emit("tinyback::moduleschema::" + module.name, _.keys(mobj.api));
							nodes[module.target] = 1;
							hook.on("*::tinyback::call::" + module.name, function (call) {
								if (call.params[call.params.length - 1] == "_t_callback") {
									call.params[call.params.length - 1] = function (err, res) {
										hook.emit("tinyback::reply::" + call.node, { rn: call.rn, err: err ? JSON.parse(JSON.stringify(err)) : null, res: res });
									};
								}
								lapi[call.func].apply(lapi, call.params);
							});
							cb();
						}).catch(err => {
							console.log("Error in module: " + module.name)
							reject(err);
						});
					} else {
						if (!nodes[module.target] && thisNode == "root") {
							// need to launch for for dedicated target
							var forkparams = Array.prototype.slice.call(process.argv, 2);
							forkparams.push("--tinybacknode=" + JSON.stringify({ target: module.target, nodes: nodes }));
							hook.emit("hook::fork", { script: process.argv[1], params: forkparams });
						}
						hook.once("*::tinyback::moduleschema::" + module.name, function (schema) {
							var apim = {};
							_.each(schema, function (f) {
								apim[f] = function () {
									var cb = arguments[arguments.length - 1];
									var args = Array.from(arguments);
									if (_.isFunction(cb)) {
										args[args.length - 1] = "_t_callback";
										var rn = thisNode + (i++);
										cbs[rn] = cb;
									}
									hook.emit("tinyback::call::" + module.name, { node: thisNode, func: f, rn: rn, params: args });
								};
							});
							api[module.name] = apim;
							nodes[module.target] = 1;
							cb();
						});

						hook.emit("tinyback::wantmoduleproxy", module.name);
						
						if (router) {
							var port = null;
							hook.emit("tinyback::wanttargetproxy::" + module.target);
							hook.on("*::tinyback::targetproxy::" + module.target, function (data) {
								port = data.port;
							})
							proxy = proxy || require('http-proxy').createProxyServer({});
							app.all("/" + module.name + '*', function (req, res) {
								if (port)
									proxy.web(req, res, { target: 'http://localhost:' + port });
							});
						}
					}
				});

				auto[module.name] = args;
			});

			var missing = _.difference(_.keys(requested), _.keys(registered));
			if (missing.length)
				throw new Error("Missing module dependancies: " + missing.join(','));
			var dt = new Date();

			safe.auto(auto, safe.sure(reject, function () {
				if (thisNode == "root")
					console.log("-> ready in " + ((new Date()).valueOf() - dt.valueOf()) / 1000.0 + " s");

				resolve({ express: app, api: api, locals: locals, target: thisNode });
			}));
		});
	});
};

module.exports.restapi = function () {
	return {
		reqs: { router: true, globalUse: true },
		deps: ['tson'],
		init: async function (ctx) {
			ctx.router.all("/:token/:module/:target", async function (req, res) {
				if (ctx.locals.newrelic)
					ctx.locals.newrelic.setTransactionName(req.method + "/" + (req.params.token == "public" ? "public" : "token") + "/" + req.params.module + "/" + req.params.target);

				var next = function (err) {
					var statusMap = { "Unauthorized": 401, "Access forbidden": 403, "Invalid Data": 422, "Not Found": 404 };
					var code = statusMap[err.subject] || 500;
					res.status(code).json(_.pick(err, ['message', 'subject', 'data']));
				};

				try {
					/* for security purposes it is required to white list modules that are exposed through api
					the reason is that not all module do check permissions and in general are allowed for external callbacks
					for backward compatibility it is ok to make empty restapi section with no restapi.modules defined.
					Example of configuration:
					restapi: {
						modules:{"statistics":1,"users":1,"web":1,
							"obac":{blacklist:{"register":1}},
							"email":{whitelist:{"getSendingStatuses":1}}}
					}
					*/
					if (!ctx.cfg.restapi)
						return next(new Error("Explicit configuration of restapi.modules is required"));

					// check if module is exist and it is whitelisted

					if (!(
						ctx.api[req.params.module] &&
						(
							!ctx.cfg.restapi.modules ||
							ctx.cfg.restapi.modules[req.params.module]
						)
					)) return next(new CustomError("No api module available", "Not Found"));

					var modCfg = ctx.cfg.restapi.modules && ctx.cfg.restapi.modules[req.params.module];
					if (!ctx.api[req.params.module][req.params.target] ||
						(
							_.isObject(modCfg) &&
							(
								(modCfg.blacklist && modCfg.blacklist[req.params.target]) ||
								(modCfg.whitelist && !modCfg.whitelist[req.params.target])
							)
						)
					) return next(new CustomError("No function available", "Not Found"));

					var params = req.method == 'POST' ? req.body : req.query;

					if (params._t_jsonq)
						params = JSON.parse(params._t_jsonq)

					if (params._t_son == 'in' || params._t_son == 'both')
						params = ctx.api.tson.decode(params);

					let result = await ctx.api[req.params.module][req.params.target](req.params.token, params);
					if (params._t_son == 'out' || params._t_son == 'both')
						result = ctx.api.tson.encode(result);

					var maxAge = 0;
					if (params._t_age) {
						var age = params._t_age;
						var s = age.match(/(\d+)s?$/); s = s ? parseInt(s[1]) : 0;
						var m = age.match(/(\d+)m/); m = m ? parseInt(m[1]) : 0;
						var h = age.match(/(\d+)h/); h = h ? parseInt(h[1]) : 0;
						var d = age.match(/(\d+)d/); d = d ? parseInt(d[1]) : 0;
						maxAge = moment.duration(d + "." + h + ":" + m + ":" + s).asSeconds();
					}

					if (maxAge) {
						res.header('Cache-Control', 'public');
						res.header("Max-Age", maxAge);
						res.header("Expires", (new Date((new Date()).valueOf() + maxAge * 1000)).toGMTString());
					} else {
						res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
						res.header('Expires', '-1');
						res.header('Pragma', 'no-cache');
					}

					res.json(_.isUndefined(result) ? null : result);
				} catch (err) {
					next(err);
				} 
			});

			return {
				api: {}
			}
		}
	};
};

module.exports.prefixify = function () {
	return {
		target: "local",
		reqs: { router: false },
		init: async function (ctx) {
			var api = require('./prefixify');
			// need to have confguration for backward compatibility
			if (ctx.defs && ctx.defs.prefixify)
				api.configure(ctx.defs.prefixify);

			return { api };
		}
	};
};

module.exports.tson = function () {
	return {
		target: "local",
		reqs: { router: false },
		init: async function (ctx) {
			return {
				api: require('./tson')
			};
		}
	};
};

function _t_registry() {
	return {
		target: "local",
		reqs: { router: false },
		deps: [],
		init: async function (ctx) {
			var store = {};
			return {
				api: {
					set: async function (k, v) {
						store[k] = v;
					},
					get: async function (k) {
						return store[k];
					},
					merge: async function (k, v) {
						var data = store[k];
						if (!data)
							data = store[k] = {};
						_.merge(data, v);
					}
				}
			}
		}
	};
}

module.exports._t_registry = _t_registry;

module.exports.mongodb = function () {
	return {
		target: "local",
		reqs: { router: false },
		deps: ['prefixify', '_t_registry'],
		init: async function (ctx) {
			var mongo = require("mongodb");

			ctx.api.prefixify.register("_id", function (pr) {
				return new mongo.ObjectID(pr.toString());
			});

			var dbcache = {};
			return {
				api: {
					getDb: async function (prm) {
						var name = prm.name || "main";
						if (dbcache[name])
							return dbcache[name];

						var cfg = ctx.cfg.mongo[name];
						if (!cfg)
							throw new Error("No mongodb database for alias " + name);

						if (cfg.url) {
							let db = await mongo.MongoClient.connect(cfg.url, { db: cfg.ccfg || {}, server: cfg.scfg || {}, replSet: cfg.rcfg || {}, mongos: cfg.mcfg || {} });
							dbcache[name] = db;
							return db;
						}
						var dbc = new mongo.Db(
							cfg.db,
							new mongo.Server(
								cfg.host,
								cfg.port,
								cfg.scfg
							),
							cfg.ccfg
						);

						let db = await dbc.open();
						dbcache[name] = db;
						if (!cfg.auth) return db;

						await db.authenticate(cfg.auth.user, cfg.auth.pwd, cfg.auth.options);
						return db;
					},
					ensureIndex: async function (col, index, options = {}) {
						var dbkey = "";
						if (col.s) {
							dbkey = col.s.db.serverConfig.host + ":" + col.s.db.serverConfig.port + "/" + col.s.db.databaseName;
						} else {
							dbkey = col.namespace || col.db.serverConfig.name + "/" + col.db.databaseName;
						}
						var indexinfo = {};
						var dbif = indexinfo[dbkey] = {};
						var colkey = col.collectionName;
						var cif = dbif[colkey];
						if (!cif) {
							cif = dbif[colkey] = { _id_: true };
						}

						let indexname = await col.ensureIndex(index, options);
						cif[indexname] = true;
						return ctx.api._t_registry.merge("indexinfo", indexinfo);
					},
					dropUnusedIndexes: async function (db) {
						if (ctx.target != "root") return;

						let indexinfo = await ctx.api._t_registry.get("indexinfo");
						var dbkey = "";
						if (db.serverConfig.name) {
							dbkey = db.serverConfig.name + "/" + db.databaseName;
						} else {
							dbkey = db.serverConfig.host + ":" + db.serverConfig.port + "/" + db.databaseName
						}
						var dbif = indexinfo[dbkey];
						if (!dbif) return;

						await Promise.all(_.map(dbif, (coll, colName) => {
							return (async () => {
								let index = await db.indexInformation(colName);
								var unused = _.difference(_.keys(index), _.keys(coll));

								await Promise.all(_.map(unused, indexName => {
									return (async () => {
										await db.collection(colName).dropIndex(indexName);
									})();
								}));
							})();
						}));
					}
				}
			}
		}
	};
};

module.exports.obac = function () {
	return {
		reqs: { router: false },
		init: async function (ctx) {

			/**
			 * [].m - module name
			 * [].f - function name
			 * [].r - regex
			 */
			var permissionsStore = [];
			return {
				api: {
					getPermission: async function (t, p) {
						let res = await ctx.api.obac.getPermissions(t, { rules: [p] });
						var granted = !!res[p.action][p._id || 'global'];
						if (!p.throw) return granted;
						if (granted) return;
						throw new CustomError("Access denied to " + p.action, "Unauthorized");
					},

					/**
					 * @param p 
					 * @param p.rules[] 
					 * @param p.rules[].action
					 */
					getPermissions: async function (t, p) {
						var result = {};
						await Promise.all(_.map(p.rules, rule => {
							return (async () => {
								let permissions = _.filter(permissionsStore, perm => perm.r.test(rule.action));
								var checks = [];
								_.each(permissions, perm => {
									if (perm.f.permission) {
										checks.push(ctx.api[perm.m][perm.f.permission](t, rule));
									}
								});

								let answers = await Promise.all(checks);
								var answer = false;
								// if any arbiter allow some action then
								// we consider it allowed (or check)
								_.each(answers, function (voice) {
									answer |= voice;
								});
								if (!result[rule.action])
									result[rule.action] = {};
								result[rule.action][rule._id || 'global'] = !!answer;
							})();
						}));
						return result;
					},
					getGrantedIds: async function (t, p) {
						var acl = _.filter(permissionsStore, function (a) {
							return a.r.test(p.action);
						});
						var checks = [];
						_.each(acl, function (a) {
							if (a.f.grantids) {
								checks.push(ctx.api[a.m][a.f.grantids](t, p));
							}
						});
						let answers = await Promise.all(checks);
						return answers.length == 1 ? answers[0] : _.intersection.apply(_, answers);
					},
					register: async function (actions, module, face) {
						_.each(actions, function (a) {
							permissionsStore.push({
								m: module,
								f: face,
								r: new RegExp(a.replace("*", ".*"))
							});
						});
					},
					getRegistered: async function (t, p) {
						return _.cloneDeep(permissionsStore);
					}
				}
			}
		}
	};
};

module.exports.validate = function () {
	var updater = require("./updater.js");
	var entries = {};
	return {
		target: "local",
		reqs: { router: false },
		init: async function (ctx) {
			return {
				api: {
					async: lxval.asyncValidate,
					register: function (id, obj) {
						var op = new updater(obj);
						entries[id] = entries[id] || {};
						op.update(entries[id]);
					},
					check: async function (id, obj, opts = {}) {
						var valFn = function (data, schema, opts) {
							return lxval.validate(data, schema, opts);
						};
						opts = _.defaults(opts, { unknownProperties: "error" });
						if (opts.isUpdate) {
							var op = new updater(obj);
							var sim = {};
							op.update(sim);
							obj = sim;
							valFn = lxval.getValidationFunction();
						}
						var schema = _.cloneDeep(entries[id] || {});
						var res = valFn(obj, schema, opts);
						if (!res.valid) {
							throw new ValidationError(res);
						}
						return obj;
					}
				}
			}
		}
	};
};

module.exports.mongocache = function () {
	var entries = {};
	var safeKey = function (key) {
		var sKey = key.toString();
		if (sKey.length > 512) {
			var md5sum = crypto.createHash('md5');
			md5sum.update(sKey);
			sKey = md5sum.digest('hex');
		}
		return sKey;
	};
	return {
		target: "local",
		reqs: { router: false },
		deps: ["mongo"],
		init: async function (ctx) {
			let db = await ctx.api.mongo.getDb({});
			return {
				api: {
					register: async function (id, opts) {
						if (id.indexOf("/") != -1)
							throw new Error("Found not allowed characters in cache id");
						var col = entries["cache_" + id];
						if (col)
							throw new Error("Cache " + id + " is already registered");

						col = await db.collection("cache_" + id);
						await ctx.api.mongo.ensureIndex(col, { d: 1 }, { expireAfterSeconds: opts.maxAge || 3600 });
						entries["cache_" + id] = col;
					},
					set: async function (id, k, v) {
						var col = entries["cache_" + id];
						if (!col) throw new Error("Cache " + id + " is not registered");
						return col.update({ _id: safeKey(k) }, { $set: { d: new Date(), v: JSON.stringify(v) } }, { upsert: true });
					},
					get: async function (id, k) {
						var col = entries["cache_" + id];
						if (!col) throw new Error("Cache " + id + " is not registered");
						let rec = await col.findOne({ _id: safeKey(k) });
						if (!rec) return null;
						return JSON.parse(rec.v);
					},
					has: async function (id, k) {
						var col = entries["cache_" + id];
						if (!col) throw new Error("Cache " + id + " is not registered");
						return col.find({ _id: safeKey(k) }).limit(1).count();
					},
					unset: async function (id, k) {
						var col = entries["cache_" + id];
						if (!col) throw new Error("Cache " + id + " is not registered");
						return col.remove({ _id: safeKey(k) });
					},
					reset: async function (id) {
						var col = entries["cache_" + id];
						if (!col) throw new Error("Cache " + id + " is not registered");
						return col.remove({});
					}
				}
			}
		}
	};
};

module.exports.readConfig = function () {
	var argv = require('yargs').argv;
	var dirPath = __dirname + "/../../",
		mcfg = require(path.resolve(dirPath, "config.js")),
		lcfg = {};
	
	try {
		lcfg = require(path.resolve(dirPath, "volume/config.js"));
	} catch (e) {
		console.error("readConfig error: ");
		console.log(e);
	}

	mcfg = _.merge({}, mcfg, lcfg);

	if (argv.config)
		mcfg = _.merge({}, mcfg, require(path.resolve(dirPath, argv.config)));

	if (mcfg.monitoring.tinelic.enable && !mcfg.app.autotest) {
		process.env['NEW_RELIC_HOME'] = path.resolve(dirPath + 'config/', "nr");
		process.env['NEW_RELIC_APP_NAME'] = mcfg.monitoring.tinelic.id;
		process.env['NEW_RELIC_HOST'] = mcfg.monitoring.tinelic.host;
		mcfg.__newrelic = require('newrelic');
	}

	if (mcfg.app.production) {
		process.env['NODE_ENV'] = "production";
	} else if (mcfg.app.test) {
		process.env['NODE_ENV'] = "test";
	} else {
		process.env['NODE_ENV'] = "development";
	}
	return mcfg;
};