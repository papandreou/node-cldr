var expect = require('expect.js'),
    uglifyJs = require('uglify-js'),
    cldrPluralRuleToJavaScriptAst = require('../lib/cldrPluralRuleToJavaScriptAst');

describe('cldrPluralRuleToJavaScriptAst', function () {
    // expectedOutput is a string of JavaScript source code rather than an AST so the tests can be more compact:
    function createTestCase(cldrPluralRuleStr, expectedOutput) {
        it(cldrPluralRuleStr, function () {
            expect(uglifyJs.uglify.gen_code(cldrPluralRuleToJavaScriptAst(cldrPluralRuleStr), {beautify: true})).to.equal(expectedOutput);
        });
    }

    createTestCase('n is 4 or n is not 6', 'n === 4 || n !== 6');
    createTestCase(' n  is  4  or  n  is  not  6 ', 'n === 4 || n !== 6');
    createTestCase('n within 2..4, 4..6', 'n >= 2 && n <= 4 || n >= 4 && n <= 6');
    createTestCase('n in 2..4, 4..6', 'n === Math.floor(n) && (n >= 2 && n <= 4 || n >= 4 && n <= 6)');
    createTestCase('n within 2, 4', 'n === 2 || n === 4');
    createTestCase('n is not 2', 'n !== 2');
    createTestCase('n mod 100 in 11..99', 'n % 100 === Math.floor(n % 100) && n % 100 >= 11 && n % 100 <= 99');
});
