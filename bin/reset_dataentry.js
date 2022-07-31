var { init } = require("./utils");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

(async () => {
  const { db, ctx } = await init();
  const colls = await db.listCollections().toArray();

  for (let coll of colls) {
    if (coll.name.indexOf("system.") !== 0) {
      let collection = await db.collection(coll.name);
      await collection.remove({});
    }
  }
    
  const basePath = path.join(__dirname, "../dataentry");
  const files = fs.readdirSync(basePath);
  const prefixify = ctx.api.prefixify.datafix;

  for (const file of files) {
    const collName = path.basename(file, ".json");
    const data = require(path.resolve(basePath, file));
    const coll = await db.collection(collName);
    await coll.insert(prefixify(data));
  }

  const hashPasswordsPath = path.resolve(__dirname, "hash_passwords");
  await new Promise((res, rej) => {
    exec(`node ${hashPasswordsPath}`, (err, stdout) => {
      if (err) {
        rej(err);
        return;
      }
      
      console.log(stdout);
      res();
    });
  })
})()
.then(() => {
	console.log("reset db success!");
	process.exit(0);
})
.catch(err => {
	console.log(err);
	process.exit(1);
});

