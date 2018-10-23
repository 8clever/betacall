const aio = require("asterisk.io");
const config = require("../local-config.js");
const fs = require("fs");
const logPath = "aster-event-logs.txt";
const ami = aio.ami(
    config.ami.host,
    config.ami.port,
    config.ami.username,
    config.ami.password
);

if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, "");
}

ami.on('ready', function(){
    ami.on("eventAny", evt => {
        writeLog(evt);

        // if (evt.Event === "PeerStatus") {
        //     writeLog(evt);
        // }
    });
});

function writeLog (evt) {
    console.log(evt);
    let logs = fs.readFileSync(logPath);
    logs += "\n";
    logs += JSON.stringify(evt);
    fs.writeFileSync(logPath, logs);
}