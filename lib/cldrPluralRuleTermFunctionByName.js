exports.i = function i(n) {
    return Math.floor(Math.abs(n));
};

exports.v = function v(n) {
    return n.toString().replace(/^[^.]*\.?/, '').length;
};

exports.w = function w(n) {
    return n.toString().replace(/^[^.]*\.?|0+$/g, '').length;
};

exports.f = function f(n) {
    return parseInt(n.toString().replace(/^[^.]*\.?/, ''), 10) || 0;
};

exports.t = function t(n) {
    return parseInt(n.toString().replace(/^[^.]*\.?|0+$/g, ''), 10) || 0;
};
