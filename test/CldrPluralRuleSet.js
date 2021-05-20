const unexpected = require('unexpected');

const esprima = require('esprima');

const escodegen = require('escodegen');

const CldrPluralRuleSet = require('../lib/CldrPluralRuleSet');

describe('CldrPluralRuleSet', () => {
  const expect = unexpected.clone();

  expect.addAssertion(
    '<object> to encode to <function>',
    (expect, subject, value) => {
      const cldrPluralRuleSet = new CldrPluralRuleSet();
      Object.keys(subject).forEach((count) => {
        cldrPluralRuleSet.addRule(subject[count], count);
      });
      const beautifiedFunction = escodegen.generate({
        type: 'Program',
        body: [
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'FunctionExpression',
              params: [
                {
                  type: 'Identifier',
                  name: 'val',
                },
              ],
              body: {
                type: 'BlockStatement',
                body: cldrPluralRuleSet.toJavaScriptFunctionBodyAst(),
              },
            },
          },
        ],
      });
      if (typeof value === 'function') {
        value = escodegen.generate(esprima.parse('(' + value.toString() + ')'));
      }
      expect(beautifiedFunction, 'to equal', value);
    }
  );

  it('should encode some basic test cases correctly', () => {
    expect({ one: 'n is 4 or n is not 6' }, 'to encode to', function (val) {
      const n = Number(val);
      if (isNaN(n)) throw Error('n is not a number');
      if (n === 4 || n !== 6) return 'one';
      return 'other';
      /* eslint-enable */
    });

    expect({}, 'to encode to', function (val) {
      const n = Number(val);
      if (isNaN(n)) throw Error('n is not a number');
      return 'other';
    });

    expect(
      {
        one: 'i = 1 and v = 0 @integer 1',
        two: 'i = 2 and v = 0 @integer 2',
        many: 'v = 0 and n != 0..10 and n % 10 = 0',
      },
      'to encode to',
      function (val) {
        /* eslint-disable */
        const n = Number(val),
          i = Math.floor(Math.abs(val)),
          v = val.toString().replace(/^[^.]*\.?/, '').length;
        if (isNaN(n)) throw Error('n is not a number');
        if (i === 1 && v === 0) return 'one';
        if (i === 2 && v === 0) return 'two';
        // prettier-ignore
        if (v === 0 && (!(n >= 0 && n <= 10) && n % 10 === 0)) return 'many';
        return 'other';
        /* eslint-enable */
      }
    );
  });

  it('should encode the Danish plural rule function from CLDR 24 correctly', () => {
    expect(
      {
        one: 'n = 1 or t != 0 and i = 0,1 @integer 1 @decimal 0.1~1.6',
        other:
          ' @integer 0, 2~16, 100, 1000, 10000, 100000, 1000000, … @decimal 0.0, 2.0~3.4, 10.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, …',
      },
      'to encode to',
      function (val) {
        /* eslint-disable */
        const n = Number(val),
          i = Math.floor(Math.abs(val)),
          t = parseInt(val.toString().replace(/^[^.]*\.?|0+$/g, ''), 10) || 0;
        if (isNaN(n)) throw Error('n is not a number');
        if (n === 1 || (!(t === 0) && (i === 0 || i === 1))) return 'one';
        return 'other';
        /* eslint-enable */
      }
    );
  });

  it('should encode the Latvian plural rule function from CLDR 24 correctly', () => {
    expect(
      {
        zero: 'n % 10 = 0 or n % 100 = 11..19 or v = 2 and f % 100 = 11..19 @integer 0, 10~20, 30, 40, 50, 60, 100, 1000, 10000, 100000, 1000000, … @decimal 0.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, …',
        one: 'n % 10 = 1 and n % 100 != 11 or v = 2 and f % 10 = 1 and f % 100 != 11 or v != 2 and f % 10 = 1 @integer 1, 21, 31, 41, 51, 61, 71, 81, 101, 1001, … @decimal 0.1, 1.0, 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 10.1, 100.1, 1000.1, …',
        other:
          ' @integer 2~9, 22~29, 102, 1002, … @decimal 0.2~0.9, 1.2~1.9, 10.2, 100.2, 1000.2, …',
      },
      'to encode to',
      // prettier-ignore
      function (val) {
        /* eslint-disable */
        const n = Number(val),
          v = val.toString().replace(/^[^.]*\.?/, '').length,
          f = parseInt(val.toString().replace(/^[^.]*\.?/, ''), 10) || 0;
          if (isNaN(n)) throw Error('n is not a number');
        if (
          n % 10 === 0 ||
          ((n % 100 === Math.floor(n % 100) &&
            (n % 100 >= 11 && n % 100 <= 19)) ||
            (v === 2 &&
              (f % 100 === Math.floor(f % 100) &&
                (f % 100 >= 11 && f % 100 <= 19))))
        )
          return 'zero';
        if (
          (n % 10 === 1 && !(n % 100 === 11)) ||
          ((v === 2 && (f % 10 === 1 && !(f % 100 === 11))) ||
            (!(v === 2) && f % 10 === 1))
        )
          return 'one';
        return 'other';
        /* eslint-enable */
      }
    );
  });

  it('should encode the French plural rule function from CLDR 39 correctly', () => {
    expect(
      {
        one: 'i = 0,1 @integer 0, 1 @decimal 0.0~1.5',
        many: 'e = 0 and i != 0 and i % 1000000 = 0 and v = 0 or e != 0..5 @integer 1000000, 1c6, 2c6, 3c6, 4c6, 5c6, 6c6, … @decimal 1.0000001c6, 1.1c6, 2.0000001c6, 2.1c6, 3.0000001c6, 3.1c6, …',
        other:
          ' @integer 2~17, 100, 1000, 10000, 100000, 1c3, 2c3, 3c3, 4c3, 5c3, 6c3, … @decimal 2.0~3.5, 10.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, 1.0001c3, 1.1c3, 2.0001c3, 2.1c3, 3.0001c3, 3.1c3, …',
      },
      'to encode to',
      // prettier-ignore
      function (val) {
        /* eslint-disable */
        const n = Number(val),
          i = Math.floor(Math.abs(val)),
          v = val.toString().replace(/^[^.]*\.?/, '').length,
          e = parseInt(val.toString().replace(/^[^e]*(e([-+]?\d+))?/, '$2')) || 0;
          if (isNaN(n)) throw Error('n is not a number');
        if (i === 0 || i === 1) return 'one';
        if (e === 0 && (!(i === 0) && (i % 1000000 === 0 && v === 0)) || !(e >= 0 && e <= 5)) return 'many';
        return 'other';
        /* eslint-enable */
    }
    );
  });

  it('should encode the Slovak plural rule function from CLDR 29 correctly', () => {
    expect(
      {
        one: 'v = 0 and i % 10 = 1 and i % 100 != 11 or f % 10 = 1 and f % 100 != 11 @integer 1, 21, 31, 41, 51, 61, 71, 81, 101, 1001, … @decimal 0.1, 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 10.1, 100.1, 1000.1, …',
        few: 'v = 0 and i % 10 = 2..4 and i % 100 != 12..14 or f % 10 = 2..4 and f % 100 != 12..14 @integer 2~4, 22~24, 32~34, 42~44, 52~54, 62, 102, 1002, … @decimal 0.2~0.4, 1.2~1.4, 2.2~2.4, 3.2~3.4, 4.2~4.4, 5.2, 10.2, 100.2, 1000.2, …',
        other:
          ' @integer 0, 5~19, 100, 1000, 10000, 100000, 1000000, … @decimal 0.0, 0.5~1.0, 1.5~2.0, 2.5~2.7, 10.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, …',
      },
      'to encode to',
      // prettier-ignore
      function (val) {
        /* eslint-disable */
        const n = Number(val),
          i = Math.floor(Math.abs(val)),
          v = val.toString().replace(/^[^.]*\.?/, '').length,
          f = parseInt(val.toString().replace(/^[^.]*\.?/, ''), 10) || 0;
          if (isNaN(n)) throw Error('n is not a number');
        if (
          (v === 0 && (i % 10 === 1 && !(i % 100 === 11))) ||
          (f % 10 === 1 && !(f % 100 === 11))
        )
          return 'one';
        if (
          (v === 0 &&
            (i % 10 === Math.floor(i % 10) &&
              (i % 10 >= 2 && i % 10 <= 4) &&
              !(i % 100 >= 12 && i % 100 <= 14))) ||
          (f % 10 === Math.floor(f % 10) &&
            (f % 10 >= 2 && f % 10 <= 4) &&
            !(f % 100 >= 12 && f % 100 <= 14))
        )
          return 'few';
        return 'other';
        /* eslint-enable */
      }
    );
  });
});
