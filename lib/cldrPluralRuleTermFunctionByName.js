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

// Note: `_tmpPlural` is a temporary variable created if the `e` and `c` operands are used.
// See `CldrPluralRuleSet.js`. We need to add this helper variable here to ensure that
// Mocha does not complain about a global variable being introduced. This would happen
// if the `e` and `c` function is executed with the `_tmpPlural` assignment to `global`.
let _tmpPlural;

// http://unicode.org/reports/tr35/tr35-numbers.html#Plural_rules_syntax. See `e` operand.
// The implementation can only determine the exponent properly if `n` is passed as string.
exports.e = function e(n) {
  // eslint-disable-next-line no-return-assign
  return (
    (_tmpPlural = n.toString().match(/^\d+e(\d+)$/)),
    _tmpPlural === null ? 0 : parseInt(_tmpPlural[1], 10)
  );
};

// http://unicode.org/reports/tr35/tr35-numbers.html#Plural_rules_syntax. The `c` operand is
// currently equal to the `e` operand. We use the same implementation.
exports.c = exports.e;
