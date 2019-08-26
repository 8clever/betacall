const _ = require("lodash");
const fs = require("fs");
const mongo = require("mongodb");
const shortId = require("short-id");
const jsonDiff = require("json-diff");
const __ = require("./__namespace");

let api = {};
let ctx = null;
let qf;
let df;

module.exports.deps = ['mongo'];

module.exports.init = async function (...args) {
	[ctx] = args;
	qf = ctx.api.prefixify.query;
	df = ctx.api.prefixify.datafix;
	return { api };
};

api.dbfiles = "fs.files";
api.initSearchApiFunction = function (collection) {

	/**
	 * @param {string} t - access token
	 * @param {Object} [p.query] - query search
	 * @param {Object} [p.sort] - sort
	 * @param {Number} [p.limit] - limit
	 * @param {Number} [p.skip] - skip
	 * @param {Object} [p.fields] - reduced object by fields
	 * @param {Object} [p.addFields] - add new fields through $addFields
	 * @param {Array} [p.lookups] - join collections
	 * @param {Array} [p.aggregate] - clean aggregate after match
	 * @param {Array} [p.unwind] - unwind of mongodb
	 *
	 * lookups - [{
	 * 		from: <collection name>,
	 *  	localField: <local field relation>,
	 *      foreignField: <remote field relation>,
	 *      as: <new feild name>
 	 * }]
	 *
	 */
	return async function (t, p) {
		p = p || {};
		p.query = qf(p.query || {});
		p.fields = p.fields || {};

		let aggregate = [];
		let utils = [
			{ $count: "count" }
		];
		let list = [
			{ $match: {} }
		];

		_.each(p.lookups, l => {
			aggregate.push({ $lookup: l });
		});

		_.each(p.aggregate, a => {
			if (a.$match)
				a.$match = qf(a.$match);
				
			aggregate.push(a);
		});

		aggregate.push({ $match: p.query });

		if (p.unwind) {
			aggregate.push({ $unwind: p.unwind });
		}

		if (!_.isEmpty(p.fields))
			aggregate.push({ $project: p.fields });

		if (!_.isEmpty(p.addFields)) {
			aggregate.push({ $addFields: p.addFields });
		}

		if (p.sort)
			list.push({ $sort: p.sort });

		if (p.skip)
			list.push({ $skip: p.skip });

		if (p.limit)
			list.push({ $limit: p.limit });

		aggregate.push({ $facet: { utils, list } });
		let [res] = await collection.aggregate(aggregate, { allowDiskUse: true }).toArray();
		return {
			count: _.get(res, "utils[0].count", 0),
			list: res.list
		};
	};
};

/**
 *
 * @param collection - name of collection
 * @returns {Function}
 */
api.initDistinctApiFunction = function (collection) {
	/**
	 * @param {string} t - access token
	 * @param {Object} [p.query] - query search
	 * @param {Object} [p.field] - sort
	 */
	return async function (t, p) {
		p = p || {};
		p.query = qf(p.query || {});
		return collection.distinct(p.field, p.query);
	};
};

api.initEditApiFunction = function ({
	collection,
	permission,
	validate,
	withID,
	withActivity,
	ignorePrefixFields
}) {
	/**
	 * @param {string} t - access token
	 * @param {Object} p
	 * @param {Object} p.data
	 * @param {Object} p.unset
	 */
	return async function (t, p) {
		let ignoreFields = _.cloneDeep(_.pick(p.data, _.keys(ignorePrefixFields)));

		p.data = df(p.data);

		if (!_.isEmpty(ignoreFields)) {
			_.extend(p.data, ignoreFields);
		}

		let _id = p.data._id;
		let writeActivity = async function() {};

		if (
			withActivity && 
			(
				!ctx.api.activity ||
				!ctx.api.users
			)
		) throw new Error("Activity and Users api is required");

		if (permission) {
			await ctx.api.obac.getPermission(t, { action: permission, throw: true });
		}

		if (_id) {
			delete p.data.id;
			let update = { $set: p.data };

			if (validate) {
				await ctx.api.validate.check(validate, update, { isUpdate: true });
			}

			if (withActivity) {
				let old = await collection.findOne({ _id });
				if (!old) throw new Error("Invalid update, old item not found!");
				
				writeActivity = async function() {
					let newItem = await collection.findOne({ _id });
					let diff = jsonDiff.diff(old, newItem);

					if (_.isPlainObject(withActivity)) {
						diff = _.pick(diff, _.keys(withActivity));
					}

					if (_.isEmpty(diff)) return;

					let u = await ctx.api.users.getCurrentUserPublic(t, {});
					await ctx.api.activity.editActivity(t, {
						data: {
							type: __.ACTIVITY_TYPE.UPDATE,
							rel: {
								_id,
								collection: collection.s.name
							},
							_iduser: u._id,
							diff
						}
					});
				}
			} 

			await collection.update({ _id }, update);

			if (!_.isEmpty(p.unset)) {
				await collection.update({ _id }, { $unset: p.unset });
			}

			await writeActivity();			

			return _id;
		}

		if (withID) {
			p.data.id = await getID()
		}

		if (validate) {
			await ctx.api.validate.check(validate, p.data);
		}

		let { ops } = await collection.insert(p.data);
		_id = ops[0]._id;

		if (withActivity) {
			writeActivity = async function() {
				let u = await ctx.api.users.getCurrentUserPublic(t, {});
				await ctx.api.activity.editActivity(t, {
					data: {
						type: __.ACTIVITY_TYPE.ADD,
						_iduser: u._id,
						rel: {
							_id,
							collection: collection.s.name
						}
					}
				});
			}
		}

		await writeActivity();

		return _id;

		async function getID () {
			let ID = shortId.generate().toUpperCase();
			let exists = await collection.findOne({ id: ID });
			if (exists) return getID();
			return ID;
		}
	}
}

api.initRmApiFunction = function ({
	collection,
	permission,
	withActivity
}) {
	return async function (t, p) {
		p = df(p);
		let _id = p._id;
		let writeActivity = async function() {};

		if (!_id) throw new Error("Invalid _id of remove function");

		if (permission) {
			await ctx.api.obac.getPermission(t, { action: permission, throw: true });
		}

		if (withActivity) {
			let old = await collection.findOne({ _id });
			if (!old) throw new Error("Old item not found!");

			writeActivity = async function () {
				let u = await ctx.api.users.getCurrentUserPublic(t, {});
				await ctx.api.activity.editActivity(t, {
					rel: {
						_id,
						collection: collection.s.name
					},
					type: __.ACTIVITY_TYPE.REMOVE,
					_iduser: u._id,
					diff: _.omit(old, "_id")
				});
			}
		}

		await collection.removeOne({ _id });
		await writeActivity();
	}
}

api.getBaseUrl = async function(t, p) {
	return `${ctx.cfg.server.https ? "https://" : "http://"}${ctx.cfg.server.domain}`;
}

/**
 * @typedef {Object} FILE_UPLOAD_ITEM
 * @property {String} fieldname - images
 * @property {String} originalname - anyName.jpg
 * @property {String} encoding - 7bit
 * @property {String} mimetype - image/jpeg
 * @property {String} destination - /tmp
 * @property {String} path - /tmp/img.jpg
 * @property {Number} size - 32427
 */

/**
 *  Save uploaded file to GridFS
 *
 * @param token
 * @param {FILE_UPLOAD_ITEM} file - returned by multer
 * @param {Object} [metadata] optional
 * @param cb
 *
 * @return {String} - _id of image
 */
api.uploadFile = async function (token, file, metadata = {}) {
	if (!_.isPlainObject(metadata)) {
		metadata = {};
	}

	let db = await ctx.api.mongo.getDb({});
	let dat = {
		content_type: file.mimetype,
		filename: file.originalname,
		metadata: metadata
	};

	return storeFileMongo(db, fs.createReadStream(file.path), dat);
};

api.getImage = async function (token, _id) {
	var self = this;
	let db = await ctx.api.mongo.getDb({});
	let images = await db.collection(self.dbfiles);
	var query = df({ _id: _id });
	if (!query._id) return;

	let image = await images.findOne(query);
	if (!image) return;

	const bucket = new mongo.GridFSBucket(db);
	image.stream = bucket.openDownloadStream(image._id);
	return image;
};

api.getFile = async function (token, id) {
	let db = await ctx.api.mongo.getDb({});
	return mongo.GridStore.read(db, new mongo.ObjectID(id.toString()));
};

api.getFileMeta = async function (token, _id) {
	if (!_id) return null;

	try {
		_id = new mongo.ObjectID(_id.toString());
	} catch (err) {
		return null;
	}

	let db = await ctx.api.mongo.getDb({});
	let files =	await db.collection(this.dbfiles);
	return files.findOne({ '_id': _id });
};

/**
 * Read file by filename & stores it into db
 * @todo stream to write a large file
 *
 * @param db database instance
 * @param pth
 *
 * @param options
 * @param options.filename
 * @param options.content_type
 * @param options.metadata
 *
 * @param cb
 */
async function storeFileMongo(db, readStream, options = null) {
	const bucket = new mongo.GridFSBucket(db);
	const stream = bucket.openUploadStream(options);
	const objectId = stream.id;

	return new Promise((resolve, reject) => {
		stream.once('finish', function () {
			resolve(objectId.toString());
		});
		stream.once('error', reject);
		readStream.pipe(stream);
	});
}