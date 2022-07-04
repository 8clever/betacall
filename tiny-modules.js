const tinyback = require("tinyback");
const path = require("path");

module.exports = [
	{name: "prefixify", object: tinyback.prefixify()},
	{name: "tson", object: tinyback.tson()},
	{name: "validate", object: tinyback.validate()},
	{name: "mongo", object: tinyback.mongodb()},
	{name: "cache", object: tinyback.mongocache()},
	{name: "obac", object: tinyback.obac()},
	{name: "restapi", object: tinyback.restapi()},

	{name:"mysql",require: path.join(__dirname, "/modules/mysql")},
	{name:"topdelivery",require: path.join(__dirname, "/modules/topdelivery")},
	{name:"coreapi",require: path.join(__dirname, "/modules/api/coreapi.js")},
	{name:"users",require: path.join(__dirname, "/modules/api/users.js")},
	{name:"email",require: path.join(__dirname, "/modules/api/email.js")},
	{name:"order",require: path.join(__dirname, "/modules/api/order.js")},
	{name:"settings",require: path.join(__dirname, "/modules/api/settings.js")},
	{name: "permission", require: path.join(__dirname, "/modules/api/permission.js") },
	
	{name:"scheduler",require: path.join(__dirname, "/modules/api/scheduler.js")},

	{name: "admin", require: path.join(__dirname, "./modules/admin")},
	{name: "asterisk", require: path.join(__dirname, "./modules/asterisk")},
	{name: "socket", require: path.join(__dirname, "./modules/socket")},
	{name: "mqtt", require: path.join(__dirname, "./modules/mqtt")},
	{name: "excel", require: path.join(__dirname, "./modules/excel")}
];