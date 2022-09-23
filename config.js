module.exports = {
	env: "development",
	app: {
		wrapErrors: 1
	},
	paint: {
		users: []
	},
	mysql: {
		main: {
			host: "",
			user: "",
			password: "",
			database: "db"
		}
	},
	topdeliveryApi: {
		apiKeys: [
			"apikey"
		]
	},
	ami: {
		dirRecords: "/var/www/html/caller/rec/",
		port: 5038,
		host: "localhost",
		username: "",
		password: "",
		exten: "333",
		gateaway: {
			default: {
				slots: 7,
				channel: "SIP/<phone>@voip1",
				regex: /SIP\/voip1/
			}
		},
		maxQueue: 1,
		addQueue: 3,
		sandbox: true,
		phone: "89066482837",
		blackList: [
			"8800",
			"8940"
		],
		blackMarkets: [],
		blackRegions: []
	},
	mqtt: {
		textToSpeech: false,
		main: {
			host: "mqtt"
		}
	},
	mongo: {
		main: {
			db: "betacall",
			host: "mongo",
			port: 27017,
			scfg: { auto_reconnect: true, poolSize: 100 },
			ccfg: { native_parser: true, w: 1 }
		}
	},
	server: {
		https: 0,
		domain: "localhost:3000",
		port: 3000,
		ssl_port: false
	},
	topDelivery: {
		url: "http://is-c-test.topdelivery.ru/api/soap/c/2.0/?wsdl",
		basicAuth: {
			user: "tdsoap",
			password: "5f3b5023270883afb9ead456c8985ba8"
		},
		bodyAuth: {
			login: "kobotovcall",
			password: "pass"
		}
	},
	monitoring: {
		tinelic: {
			enable: false,
			protocol: "https",
			host: "errbit.pushok.com",
			id: "",
			mode: "prod"
		},
		ga: {
			enable: false,
			id: ""
		}
	},
	salt: "",
	masterpass: "",
	upload: {
		fileTypes: [
			"jpeg",
			"png"
		]
	},
	restapi: {},
	email: {
		enable: true,
		sandbox: true,
		period: "0 */5 * * * *",
		apiKey: "",
		fromEmail: "robot@betacall.ru",
		fromName: "betacall",
		smtp: {
			host: "smtp.mandrillapp.com",
			auth: {
				user: "",
				pass: ""
			},
			tls: {
				rejectUnauthorized: false
			}
		},
		toEmails: []
	}
};
