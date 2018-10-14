var	count = 0;
var argon2 = require('argon2');
var { init } = require("./utils");

(async () => {
	let { cols, db } = await init();
	cols.users = await db.collection("users");
	var cursor = cols.users.find({ password: { $exists: 1 }}, { password: 1 });
	let check = true;

	while (check) {
		let u = await cursor.nextObject();

		if (u === null) {
			check = false;
		} else {
			if (!/argon2/.test(u.password)) {
				let hash = await argon2.hash(u.password)
				await cols.users.update({ "_id": u._id }, { $set: { "password": hash }});
				count++;
			}
		}
	}
})()
.then(() => {
	console.log("update " + count + " users");
	process.exit(0);
})
.catch(err => {
	console.log(err);
	process.exit(1);
});

