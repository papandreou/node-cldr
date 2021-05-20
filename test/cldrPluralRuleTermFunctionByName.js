const expect = require('unexpected');

const cldrPluralRuleTermFunctionByName = require('../lib/cldrPluralRuleTermFunctionByName');

// http://unicode.org/reports/tr35/tr35-numbers.html#Operands

const expectedOutputByTermAndInput = {
  i: {
    1: 1,
    '1.0': 1,
    '1.00': 1,
    1.3: 1,
    '1.30': 1,
    1.03: 1,
    '1.230': 1,
  },
  v: {
    1: 0,
    '1.0': 1,
    '1.00': 2,
    1.3: 1,
    '1.30': 2,
    1.03: 2,
    '1.230': 3,
  },
  w: {
    1: 0,
    '1.0': 0,
    '1.00': 0,
    1.3: 1,
    '1.30': 1,
    1.03: 2,
    '1.230': 2,
  },
  f: {
    1: 0,
    '1.0': 0,
    '1.00': 0,
    1.3: 3,
    '1.30': 30,
    1.03: 3,
    '1.230': 230,
  },
  t: {
    1: 0,
    '1.0': 0,
    '1.00': 0,
    1.3: 3,
    '1.30': 3,
    1.03: 3,
    '1.230': 23,
  },
  e: {
    1: 0,
    '1.0': 0,
    '1.0.0': 0,
    10e10: 0,
    '10e10': 10,
    10: 0,
    '10e-3': -3,
    '10e+4': 4,
  },
  c: {
    1: 0,
    '1.0': 0,
    '1.0.0': 0,
    10e10: 0,
    '10e10': 10,
    10: 0,
    '10e-3': -3,
    '10e+4': 4,
  },
};

describe('cldrPluralRuleTermFunctionByName', () => {
  Object.keys(expectedOutputByTermAndInput).forEach((term) => {
    describe('#' + term, () => {
      const expectedOutputByInput = expectedOutputByTermAndInput[term];
      Object.keys(expectedOutputByInput).forEach((input) => {
        it('should compute ' + term + '(' + input + ')', () => {
          expect(
            cldrPluralRuleTermFunctionByName[term](input),
            'to equal',
            expectedOutputByInput[input]
          );
        });
      });
    });
  });
});
