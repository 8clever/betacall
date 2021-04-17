const fs = require('fs');
const path = require('path');
const tinyback = require('tinyback');
const modules = require("./tiny-modules");
const http = require('http');
const https = require('https');
const express = require('express');
const sstatic = express.static;
const argv = require('yargs').argv;
const tinyPromise = require("./tiny-promise");
const __ = require("./modules/api/__namespace");

let cfg = { modules };

console.time("Live !");

startApp().catch(err => {
	console.log(err);
	if (err && err.originalError)
		console.log(err.originalError);
	process.exit(0);
});

async function startApp () {
	let config = await tinyback.readConfig();
	cfg.config = config;

	let app = await	tinyback.createApp(cfg);
	let newrelic = config.__newrelic;

	app.locals.newrelic = newrelic;
	app.express.use(sstatic(__dirname + "/public", { maxAge: 600000 }));
	app.express.get("/robots.txt", function (req, res, next) {
		res.setHeader('Content-Type', 'text/plain');
		res.write("User-agent: *\n");
		res.write("Disallow: /");
		res.end();
	});
	app.express.get("/", (req, res) => { res.redirect(__.PREFIX_ADMIN + "/") });

	let db = await app.api.mongo.getDb({});
	await app.api.mongo.dropUnusedIndexes(db);

	if (argv.resetCollection) {
		let collName = argv.resetCollection;
		let coll = await db.collection(collName);
		await coll.drop();
		let basePath = __dirname + "/dataentry";
		let data = require(path.resolve(basePath, collName + ".json"));
		var prefixify = app.api.prefixify.datafix;
		await coll.insert(prefixify(data));
	}

	tinyPromise(app, newrelic);
	console.timeEnd("Live !");

	var httpServer = http.Server(app.express);
	if (app.api.socket && app.api.socket.init) await app.api.socket.init(app, httpServer);
	httpServer.listen(cfg.config.server.port);

	if (argv.env === "test") {
		await require("./test")(app);
	}
}
