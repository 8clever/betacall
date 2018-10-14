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

	{name:"coreapi",require: path.join(__dirname, "/modules/api/coreapi.js")},
	{name:"users",require: path.join(__dirname, "/modules/api/users.js")},
	{name:"email",require: path.join(__dirname, "/modules/api/email.js")},
	{name: "permission", require: path.join(__dirname, "/modules/api/permission.js") },
	
	{name:"scheduler",require: path.join(__dirname, "/modules/api/scheduler.js")},

	{name: "admin", require: path.join(__dirname, "./modules/admin")}
];