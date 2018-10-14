
let ctx = null;
let api = {};

module.exports.init = async function(...args) {
    [ ctx ] = args;
    return { api }
}