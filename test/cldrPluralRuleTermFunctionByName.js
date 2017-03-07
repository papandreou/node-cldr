var expect = require('unexpected'),
    cldrPluralRuleTermFunctionByName = require('../lib/cldrPluralRuleTermFunctionByName'),
    // http://unicode.org/reports/tr35/tr35-numbers.html#Operands
    expectedOutputByTermAndInput = {
        i: {'1': 1, '1.0': 1, '1.00': 1, '1.3': 1, '1.30': 1, '1.03': 1, '1.230': 1},
        v: {'1': 0, '1.0': 1, '1.00': 2, '1.3': 1, '1.30': 2, '1.03': 2, '1.230': 3},
        w: {'1': 0, '1.0': 0, '1.00': 0, '1.3': 1, '1.30': 1, '1.03': 2, '1.230': 2},
        f: {'1': 0, '1.0': 0, '1.00': 0, '1.3': 3, '1.30': 30, '1.03': 3, '1.230': 230},
        t: {'1': 0, '1.0': 0, '1.00': 0, '1.3': 3, '1.30': 3, '1.03': 3, '1.230': 23}
    };


describe('cldrPluralRuleTermFunctionByName', function () {
    Object.keys(expectedOutputByTermAndInput).forEach(function (term) {
        describe('#' + term, function () {
            var expectedOutputByInput = expectedOutputByTermAndInput[term];
            Object.keys(expectedOutputByInput).forEach(function (input) {
                it('should compute ' + term + '(' + input + ')', function () {
                    expect(cldrPluralRuleTermFunctionByName[term](input), 'to equal', expectedOutputByInput[input]);
                });
            });
        });
    });
});
