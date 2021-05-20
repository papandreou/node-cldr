const expect = require('unexpected')
  .clone()
  .use(require('unexpected-function-equality'));

const cldr = require('../lib/cldr');

describe('extractPluralRuleFunction', () => {
  it('should extract the Romanian plural rule function correctly', () => {
    const romanianPluralRule = cldr.extractPluralRuleFunction('ro');
    // prettier-ignore
    expect(romanianPluralRule, 'to equal', function anonymous(val) {
      /* eslint-disable */
      const n = Number(val),
        i = Math.floor(Math.abs(val)),
        v = val.toString().replace(/^[^.]*\.?/, '').length;
        if (isNaN(n)) throw Error('n is not a number');
      if (i === 1 && v === 0) return 'one';
      if (
        !(v === 0) ||
        (n === 0 ||
          (n % 100 === Math.floor(n % 100) && (n % 100 >= 2 && n % 100 <= 19)))
      )
        return 'few';
      return 'other';
      /* eslint-enable */
    });
  });

  it('should build a Danish plural rule function that considers the number 0 to be in the "other" category', () => {
    expect(cldr.extractPluralRuleFunction('da')(0), 'to equal', 'other');
  });
});
