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

// http://unicode.org/reports/tr35/tr35-numbers.html#Plural_rules_syntax. See `e` operand.
// The implementation can only determine the exponent properly if `n` is passed as string.
exports.e = function e(n) {
  // eslint-disable-next-line no-return-assign
  return (n = n.toString().match(/^\d+e(\d+)$/), n === null ? 0 : parseInt(n[1], 10));
}

// http://unicode.org/reports/tr35/tr35-numbers.html#Plural_rules_syntax. The `c` operand is
// currently equal to the `e` operand. We use the same implementation.
exports.c = exports.e;