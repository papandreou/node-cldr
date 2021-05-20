exports.n = function n(val) {
  return Number(val);
};

exports.i = function i(val) {
  return Math.floor(Math.abs(val));
};

exports.v = function v(val) {
  return val.toString().replace(/^[^.]*\.?/, '').length;
};

exports.w = function w(val) {
  return val.toString().replace(/^[^.]*\.?|0+$/g, '').length;
};

exports.f = function f(val) {
  return parseInt(val.toString().replace(/^[^.]*\.?/, ''), 10) || 0;
};

exports.t = function t(val) {
  return parseInt(val.toString().replace(/^[^.]*\.?|0+$/g, ''), 10) || 0;
};

// http://unicode.org/reports/tr35/tr35-numbers.html#Plural_rules_syntax. See `e` operand.
// The implementation can only determine the exponent properly if `n` is passed as string.
exports.e = function e(val) {
  return parseInt(val.toString().replace(/^[^e]*(e([-+]?\d+))?/, '$2')) || 0;
};

// http://unicode.org/reports/tr35/tr35-numbers.html#Plural_rules_syntax. The `c` operand is
// currently equal to the `e` operand. We use the same implementation.
exports.c = exports.e;
