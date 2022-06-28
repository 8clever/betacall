const __ = require("./__namespace");
const _ = require("lodash");

let api = {};
let cols = {};
let ctx = null;
let COLLECTION = __.ESSENCE

module.exports.deps = ['mongo', 'obac'];
module.exports.init = async function (...args) {
    [ ctx ] = args;
    
    ctx.api.validate.register(COLLECTION.SETTINGS, {
        $set: {
			properties: {
				_id: {
					type: "mongoId"
				},
                robots: {
                    required: true,
                    type: "object",
                    properties: {
                        _i_count: {
                            type: "number",
                            minimum: 0,
                            required: true
                        },
                        start: {
                            type: "boolean"
                        }
                    }
                },
				timeCalls: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            region: {
                                type: "string",
                                required: true,
                                minLength: 2
                            },
                            _i_start: {
                                type: "number",
                                minimum: 0,
                                maximum: 24,
                                required: true
                            },
                            _i_end: {
                                type: "number",
                                minimum: 0,
                                maximum: 24,
                                required: true
                            }
                        }
                    }
                },
                marks: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: {
                                type: "string",
                                required: true
                            },
                            name: {
                                type: "string",
                                required: true,
                                minLength: 2
                            }
                        }
                    }
                }
			}
		}
    });

    let db = await ctx.api.mongo.getDb({});
    cols[COLLECTION.SETTINGS] = await db.collection(COLLECTION.SETTINGS);

    api._getSettings = ctx.api.coreapi.initSearchApiFunction(cols[COLLECTION.SETTINGS]);
    api.editSettings = ctx.api.coreapi.initEditApiFunction({
        collection: cols[COLLECTION.SETTINGS],
        validate: COLLECTION.SETTINGS
    });

    return { api };
};

api.getSettings = async (t, p) => {
    const DEFAULT = "default";
    let settings = await ctx.api.settings._getSettings(t, {});
    settings = settings.list[0] || {};
    settings.timeCalls = settings.timeCalls || [];
    settings.marks = settings.marks || [];
    settings.robots = settings.robots || { _i_count: 0, start: false }

    let defaultExists = _.find(settings.timeCalls, _.matches({ region: DEFAULT }));
    if (!defaultExists) {
        settings.timeCalls.push({ 
            region: DEFAULT, 
            _i_start: 9,
            _i_end: 21
        })
    }

    return settings;
}

// permissions

api[ __.PERMISSION.SETTINGS.VIEW ] = async (t, p) => {
    let u = await ctx.api.users.getCurrentUserPublic(t, {});
    return u.role === __.ROLES.ADMIN;
}

api[ __.PERMISSION.SETTINGS.EDIT ] = async (t, p) => {
    let u = await ctx.api.users.getCurrentUserPublic(t, {});
    return u.role === __.ROLES.ADMIN;
}