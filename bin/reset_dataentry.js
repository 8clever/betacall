var { init } = require("./utils");
const path = require("path");
const fs = require("fs");

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
})()
.then(() => {
	console.log("reset db success!");
	process.exit(0);
})
.catch(err => {
	console.log(err);
	process.exit(1);
});

