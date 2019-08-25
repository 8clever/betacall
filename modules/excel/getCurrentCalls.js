const xlsx = require("node-xlsx");
const _ = require("lodash");
const moment = require("moment");

module.exports = {
  getCurrentCalls
}

function getCurrentCalls (ctx) {
  return async (req, res) => {
    const query = {};
  
    if (req.query.orderId) query["orderIdentity.orderId"] = req.query.orderId;
    if (req.query.phone) query["clientInfo.phone"] = req.query.phone;
  
    const orders = await ctx.api.order.getOrders(res.locals.token, { query });
    let data = [[
      "OrderID", 
      "Phone", 
      "Client", 
      "End of Storage Date",
      "Market Name",
      "Full Price"
    ]];
  
    orders.list.forEach(order => {
        const orderId = _.get(order, "orderIdentity.orderId");
        const phone = _.get(order, "clientInfo.phone");
        const client = _.get(order, "clientInfo.fio");
        const marketName = _.get(order, "orderUrl", "");
        const price = _.get(order, "clientFullCost");
        let endOfStorageDate = _.get(order, "endOfStorageDate");
        if (endOfStorageDate) {
            endOfStorageDate = moment(endOfStorageDate.v || endOfStorageDate).format("YYYY-MM-DD");
        }
  
        data.push([
            orderId,
            phone,
            client,
            endOfStorageDate,
            marketName,
            price   
        ]);
    });
  
    let buff = xlsx.build([
        { name: "Current Orderds", data }
    ]);
  
    res.send(buff);
  }
}
