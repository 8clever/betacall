const Nighthawk = require("nighthawk");
const routes = require('../routes');
import { __ } from "../utils/index.jsx";

Nighthawk.prototype.reload = function () {
    let location = this.currentLocation;
    this.currentLocation = null;
    this.changeRoute(__.PREFIX_ADMIN + location);
}

global._t_son = "out";
global.isBrowser = true;
global.router = new Nighthawk({ base: __.PREFIX_ADMIN });

routes(global.router);
global.router.listen();

if (module.hot) {
    module.hot.accept();
}