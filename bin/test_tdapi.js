const config = require("../config.js");
const soap = require("soap");
const fs = require("fs");

(async () => {
  const topDelivery = await soap.createClientAsync(config.topDelivery.url);
  topDelivery.setSecurity(new soap.BasicAuthSecurity(
    config.topDelivery.basicAuth.user,
    config.topDelivery.basicAuth.password
  ));

  const [ orders ] = await topDelivery.getCallOrdersAsync({
    auth: config.topDelivery.bodyAuth
  });

  console.log(orders)
})().catch(e => {
  console.log(e.Fault);
  fs.writeFileSync("./log.txt", e.body);
}) 