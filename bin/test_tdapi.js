const tinyback = require('tinyback');
const soap = require("soap");
const fs = require("fs");

(async () => {
  const config = await tinyback.readConfig();
  const topDelivery = await soap.createClientAsync(config.topDelivery.url);
  topDelivery.setSecurity(new soap.BasicAuthSecurity(
    config.topDelivery.basicAuth.user,
    config.topDelivery.basicAuth.password
  ));

  const [ result ] = await topDelivery.getCallOrdersAsync({
    auth: config.topDelivery.bodyAuth
  });

  const { orderInfo } = result;
  const order = orderInfo[0]
  const { orderId } = order.orderIdentity

  const [ response ] = await topDelivery.getNearDeliveryDatesIntervalsAsync({
    auth: config.topDelivery.bodyAuth,
    orderIdentity: {
      orderId
    }
  })
  const { dateTimeIntervals } = response;

  console.dir(dateTimeIntervals, { depth: null });
})().catch(e => {
  console.log(e.Fault ? e.Fault : e);
  fs.writeFileSync("./log.txt", e.body);
}) 