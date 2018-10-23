const { init } = require("./utils");

updateDb()
    .then(() => {
        console.log("done!")
        process.exit(0)
    })
    .catch(err => {
        console.log(err);
        process.exit(1);
    });

async function updateDb () {
    let { db } = await init();
}