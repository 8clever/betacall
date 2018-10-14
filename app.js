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

	if (argv.resetDataentry) {
		let colls = await db.listCollections().toArray();
		for (let coll of colls) {
			if (coll.name.indexOf("system.") !== 0) {
				let collection = await db.collection(coll.name);
				await collection.remove({});
			}
		}
			
		let basePath = __dirname + "/dataentry";
		let files = fs.readdirSync(basePath);
		let prefixify = app.api.prefixify.datafix;
		for (let file of files) {
			let collName = path.basename(file, ".json");
			let data = require(path.resolve(basePath, file));
			let coll = await db.collection(collName);
			await coll.insert(prefixify(data));
		}
	} else if (argv.resetCollection) {
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
	if (cfg.config.server.ssl_port) {
		try {
			var options = {
				key: fs.readFileSync(path.resolve(__dirname + '/privatekey.pem'), 'utf8'),
				cert: fs.readFileSync(path.resolve(__dirname + '/certificate.pem'), 'utf8'),
				ssl: true,
				plain: false
			};

			var httpsServer = https.createServer(options, app.express);

			httpsServer.listen(cfg.config.server.ssl_port);
		} catch (e) { /* */ }
	}

	var httpServer = http.createServer(app.express);
	httpServer.listen(cfg.config.server.port);

	if (cfg.config.automated && process.send) {
		process.send({ c: "startapp_repl", data: null });
	}
}
