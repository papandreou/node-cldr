var expect = require('unexpected')
  .clone()
  .use(require('unexpected-function-equality'));

var cldr = require('../lib/cldr');

describe('extractPluralRuleFunction', function() {
  it('should extract the Romanian plural rule function correctly', function() {
    var romanianPluralRule = cldr.extractPluralRuleFunction('ro');
    expect(romanianPluralRule, 'to equal', function anonymous(n) {
      /* eslint-disable */
      var i = Math.floor(Math.abs(n)),
        v = n.toString().replace(/^[^.]*\.?/, '').length;
      if (typeof n === 'string') n = parseInt(n, 10);
      if (i === 1 && v === 0) return 'one';
      if (
        !(v === 0) ||
        (n === 0 ||
          (!(n === 1) &&
            (n % 100 === Math.floor(n % 100) &&
              (n % 100 >= 1 && n % 100 <= 19))))
      )
        return 'few';
      return 'other';
      /* eslint-enable */
    });
  });

  it('should build a Danish plural rule function that considers the number 0 to be in the "other" category', function() {
    expect(cldr.extractPluralRuleFunction('da')(0), 'to equal', 'other');
  });
});
