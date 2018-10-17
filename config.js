module.exports = {
	env: "development",
	app: {
		wrapErrors: 1
    },
    ami: {
        port: 5038,
        host: "localhost",
        username: "",
		password: "",
		context: ""
    },
	mongo: {
		main: {
			db: "betacall",
			host: "localhost",
			port: 27017,
			scfg: {auto_reconnect: true, poolSize: 100},
			ccfg: {native_parser: true, w: 1}
		}
	},
	mysql: {
		main: {
			host: "",
			user: "",
			password: "",
			database: "db"
		}
	},
	server: {
		https: 0,
		domain: "localhost:3000",
		port: 3000,
		ssl_port: false
	},
	topDelivery: {
		url: "http://is-test.topdelivery.ru/api/soap/c/2.0/?WSDL",
		basicAuth: {
			user: "tdsoap",
			password: "5f3b5023270883afb9ead456c8985ba8"
		},
		bodyAuth: {
			login: "KobotovCall",
			password: "pass"
		}
	},
	monitoring: {
		tinelic: {
			enable: false,
			protocol: "https",
			host: "errbit.pushok.com",
			id: "",
			mode:"prod"
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
	restapi:{},
	email: {
		enable: true,
		sandbox: true,
		period: "0 */5 * * * *",
		apiKey: "",
		fromEmail: "robot@betacall.ru",
		fromName: "betacall",
		smtp:{
			host : "smtp.mandrillapp.com",
			auth: {
				user : "",
				pass : ""
			},
			tls: {
				rejectUnauthorized: false
			}
		},
		toEmails: []
	}
};
