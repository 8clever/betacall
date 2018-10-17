"use strict";

const _ = require("lodash"),
	tb = require('tinyback'),
	argon2 = require('argon2'),
	moment = require('moment'),
	__ = require("./__namespace.js"),
	shortId = require("short-id"),
	CustomError = tb.CustomError;

function UnknownCurrentUserError() {
	this.constructor.prototype.__proto__ = CustomError.prototype;
	this.message = 'Current user is unknown';
	this.subject = __.ERROR.SUBJECT.UNAUTHORIZED;
}

function ExistingUser() {
	this.constructor.prototype.__proto__ = CustomError.prototype;
	this.message = 'User with this email already exists';
	// this.subject = 'Unauthorized';
}

function FailedCredentialsError() {
	this.constructor.prototype.__proto__ = CustomError.prototype;
	this.message = 'Email or password not found';
	this.subject = 'Not Authorized';
}

function getHash(p, salt) {
	var crypto = require('crypto');
	var shasum = crypto.createHash('sha512');
	shasum.update(p);
	shasum.update(salt);
	var d = shasum.digest('hex');
	return d;
}

var api = {}, ctx, qf, df, cols = {};
const { ROLES, PERMISSION } = __;
const COLLECTION = __.ESSENCE;

module.exports.deps = ['mongo', 'obac'];
module.exports.init = async function (...args) {
	[ctx] = args;
	qf = ctx.api.prefixify.query;
	df = ctx.api.prefixify.data;

	/**
	 * @typedef {Object} USER_TOKEN
	 * @property {String} token
	 * @property {Date} _dt - date of creation token
	 * @property {Date} _idexp - date of expire token
	 * @property {String} tz - time zone
	 */

	/**
	 * @typedef {Object} USER_ITEM
	 * @property {String} name
	 * @property {String} email
	 * @property {String} password
	 * @property {String} role
	 * @property {USER_TOKEN[]} tokens
	 */

	ctx.api.validate.register("user", {
		$set: {
			properties: {
				_id: {
					type: "mongoId",
					messages: {
						type: "Invalid type of user _id. Please contact with developer team"
					}
				},
				login: {
					type: "string",
					format: "integer",
					required: true,
					minLength: 3,
					maxLength: 3,
					messages: {
						type: "Invalid type of Login",
						required: "Login is required",
						minLength: "Login is too short"
					}
				},
				name: {
					type: "string",
					required: true,
					minLength: 3,
					maxLength: 32,
					messages: {
						type: "Invalid type of Name",
						required: "Name is required",
						minLength: "Name is too short",
						maxLength: "Name is too large"
					}
				},
				email: {
					"type": "string",
					"format": 'email',
					required: true,
					messages: {
						type: "Invalid type of Email",
						format: "Invalid Email format",
						required: "Email is required"
					}
				},
				password: {
					type: "string",
					required: true,
					minLength: 6,
					messages: {
						type: "Invalid type of Password",
						required: "Password is required",
						minLength: "Password is too short"
					}
				},
				role: {
					type: "string",
					required: true,
					minLength: 2,
					enum: _.values(ROLES)
				},
				lang: {
					type: "string",
					enum: _.values(__.LANGS)
				},
				googleId: {
					type: "string",
					minLength: 2
				}
			}
		}
	});

	ctx.api.validate.register("link_for_user", {
		$set: {
			properties: {
				_id: {
					type: "mongoId"
				},
				_iduser: {
					type: "mongoId",
					required: true
				},
				link: {
					type: "string"
				},
				_dt: {
					type: "date",
					required: true
				},
				type: {
					type: "string"
				}
			}
		}
	});

	let db = await ctx.api.mongo.getDb({});
	cols[COLLECTION.USERS] = await db.collection(COLLECTION.USERS);
	cols[COLLECTION.LINKS] = await db.collection(COLLECTION.LINKS);

	await ctx.api.mongo.ensureIndex(cols[COLLECTION.USERS], { "tokens.token": 1 });
	await ctx.api.mongo.ensureIndex(cols[COLLECTION.USERS], { "email": 1 }, { unique: true });
	await ctx.api.mongo.ensureIndex(cols[COLLECTION.LINKS], { _iduser: 1 });
	await ctx.api.mongo.ensureIndex(cols[COLLECTION.LINKS], { _dt: 1 }, { expireAfterSeconds: 3600 * 24 * 5 });

	api.getUsers = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.USERS]);
	return { api };
};

api.getRoles = async function (t, p) {
	return _.values(ROLES);
};

/**
 * REQUIRED ONLY FOR CHECK_IN
 */
api.addUserItem = async function (t, p) {
	p.data.email = p.data.email.trim();

	let user = await cols.users.findOne({ 'email': p.data.email });
	if (user) throw new ExistingUser();

	await ctx.api.validate.check("user", df(p.data));
	let hash = await argon2.hash(p.data.password, {});
	p.data.password = hash;
	return cols.users.insert(df(p.data));
};

/**
 *
 * @param t
 * @param p
 * @param {USER_ITEM} p.data
 */
api._editUser = async function (t, p) {
	p.data = df(p.data);
	let _iduser = p.data._id;
	await ctx.api.obac.getPermission(t, { 
		action: PERMISSION.USER.EDIT, 
		throw: true,
		_iduser 
	});

	if (_iduser) {
		let update = { $set: p.data };
		await ctx.api.validate.check("user", update, { isUpdate: true });
		if (p.data.password) {
			update.$set.password = await argon2.hash(p.data.password, {});
		}
		await cols.users.update({ _id: _iduser }, update);
		return _iduser;
	}

	await ctx.api.validate.check("user", p.data);
	p.data.password = await argon2.hash(p.data.password, {});
	let { ops } = await cols.users.insert(p.data);
	return ops[0]._id;
};

api.editUser = async function (t, p) {
	return this._editUser(t, p);
}

/**
 * @param t
 * @param p
 * @param p._iduser
 */
api.rmUser = async function (t, p) {
	await ctx.api.obac.getPermission(t, { action: PERMISSION.USER.EDIT, throw: true });
	let q = df({ _id: p._iduser });
	if (!q._id) throw new Error("Invalid _id of user");
	await cols.users.update(q, { $set: { _b_active: false } });
};

/**
 * Public (can be requested by rest) version of users.getCurrentUser
 * @param t
 * @param p
 * @return Promise<USER_ITEM>
 */
api.getCurrentUserPublic = async function (t, p) {
	let user = await cols.users.findOne(
		{
			'tokens.token': t,
			_b_active: {
				$ne: false
			}
		},
		{
			password: 0,
			tokens: 0
		}
	);
	if (!user) throw new UnknownCurrentUserError();
	return user;
};

/**
 * Get current user
 * @param t
 * @returns Proimse<USER_ITEM>
 */
api.getCurrentUser = async function (t) {
	let user = await cols.users.findOne({ 'tokens.token': t, _b_active: { $ne: false } });
	if (!user) throw new UnknownCurrentUserError();
	return user;
};
/**
 * @param {String} t Auth token
 * @param {Object} p
 * @param {String} p.email - Login name
 * @param {String} p.password - Password
 * @param {Function} cb
 * @return {String} New auth token
 */
api.login = async function (t, p) {
	let query = {
		_b_active: { $ne: false },
		login: p.email
	};
	let users = await this.getUsers(t, { query });
	if (!(users.count === 1)) throw new FailedCredentialsError();
	let user = users.list[0];
	let match = await argon2.verify(user.password, p.password);
	if (!match) throw new FailedCredentialsError();

	let token = await this._generateToken(t, {});
	await this._updateUserToken(t, {
		token,
		_iduser: user._id,
		tz: p.tz
	});
	return token;
};

api._generateToken = async function (t, p) {
	return Math.random().toString(36).slice(-14);
};

/**
 * @param p._iduser
 * @param p.token; 
 * @param [p.tz]
*/
api._updateUserToken = async function (t, { _iduser, token, tz }) {
	let _dt = new Date();
	let range = 7 * 24 * 60 * 60 * 1000;
	let _dtexp = new Date(Date.parse(Date()) + range);

	await cols.users.update(
		{ _id: _iduser },
		{ $push: { tokens: { token, _dt, _dtexp, tz } } }
	);
	await cols.users.update(
		{ _id: _iduser },
		{ $pull: { tokens: { _dtexp: { $lt: _dt } } } }
	);
};

/**
 * @param t
 * @param u
 * @param cb
 */
api.logout = async function (t, p) {
	await cols.users.update({ 'tokens.token': t }, { $pull: { tokens: { token: t } } }, {});
};

api.restorePassword = async function (t, p) {
	var email = p.email,
		link_for_user = {};

	let res = await cols.users.findOne(qf({ email: new RegExp("^" + _.escapeRegExp(email) + "$", "i"), _b_active: { $ne: '0' } }));
	if (!res)
		throw new Error("Пользователь с такой эл. почтой не найден");

	link_for_user._iduser = res._id;
	var randomString = (Math.random().toString(36)).slice(2, 8 + 2);
	link_for_user.link = getHash(randomString, ctx.cfg.salt);
	var data = {
		link: link_for_user.link,
		to: p.email,
		name: res.name
	};

	await ctx.api.users.addInvitationLink(t, { data: link_for_user, restore: true });
	await ctx.api.email.saveRestorPassMessage(t, data);
};

api.addInvitationLink = async function (t, p) {
	p.data.type = "restore_password";
	p.data._dt = new Date();
	await ctx.api.validate.check("link_for_user", df(p.data));
	await cols.links.insert(df(p.data));
};

api.checkInvitedUser = async function (p) {
	let res = await cols.links.findOne(qf({ link: p }));
	if (!res) throw UnknownCurrentUserError();
	
	let user = await cols.users.findOne(qf({ _id: res._iduser }), { _id: 1, email: 1 });
	if (!user) throw new UnknownCurrentUserError();
	user.inv = true;
	var currentDate = moment();
	var datalink = moment(res._dt);
	var _dtchange = currentDate.diff(datalink, 'hours');
	if (_dtchange <= 24) {
		return { 
			user: user, 
			type: res.type 
		};
	}
	var err = { subject: "NotFound" };
	throw err;
};

api.resetForLogin = async function (t, p) {
	var data = {
		password: p.data.password,
		email: p.data.email
	};

	await cols.links.remove(qf({ _iduser: p.data._id }));
	let hash = argon2.hash(p.data.password, {});
	await cols.users.update(qf({ _id: p.data._id }), { $set: { password: hash }});
	let user = await cols.users.findOne(qf({ _id: p.data._id }));
	data.login = user.login;
	await ctx.api.email.saveRestorPassMessage({}, user);
	return ctx.api.users.login("public", _.extend({ tz: new Date().getTimezoneOffset() }, data));
};

api.loginGoogle = async function(notRequired, { profile, tz }) {
	if (!profile) throw new Error("Google profile is required");

	const { googleId, email, name } = profile;
	if (!(
		googleId,
		email,
		name
	)) throw new Error("Google Profile is required: googleId, email, name");

	let t = await ctx.api.scheduler._getRobotToken("", {});
	let users = await this.getUsers(t, { 
		query: { email },
		fields: { tokens: 0 }
	});

	if (users.count) {
		let user = users.list[0];
		user.googleId = user.googleId || googleId;
		return giveAccess.call(this, user);
	}

	let newUser = {
		login: `${email}-${shortId.generate().toUpperCase()}`,
		password: `${shortId.generate()}${shortId.generate()}`,
		role: __.ROLES.ROADMAP,
		lang: __.LANG_DEF,
		googleId,
		name,
		email
	}

	return giveAccess.call(this, newUser);

	async function giveAccess (user) {
		let _token = await this._generateToken();
		let _iduser = await this.editUser(t, { data: user });
		await this._updateUserToken(t, {
			_iduser,
			token: _token,
			tz
		});
		return _token;
	}
}

// permissions
api.permUserView = async function (t, p) {
	let u = await this.getCurrentUser(t, {});
	return u.role === __.ROLES.ADMIN;
}

/**
 * @param p._iduser
 */
api.permUserEdit = async function (t, p) {
	let user = await this.getCurrentUser(t, {});

	// admin can edit anywhere
	if (user.role === ROLES.ADMIN) return true;
	
	// user can edit himself
	if (p._iduser && user._id.toString() === p._iduser.toString()) return true;

	return false;
};