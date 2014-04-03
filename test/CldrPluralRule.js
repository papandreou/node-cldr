var unexpected = require('unexpected'),
    uglifyJs = require('uglify-js'),
    CldrPluralRule = require('../lib/CldrPluralRule');

describe('CldrPluralRule', function () {
    var expect = unexpected.clone();

    // `value` is a string of JavaScript source code rather than an AST so the tests can be more compact:
    expect.addAssertion('to encode to', function (expect, subject, value) {
        expect(uglifyJs.uglify.gen_code(new CldrPluralRule(subject).toJavaScriptAst(), {beautify: true}), 'to equal', value);
    });

    it('should encode some assorted test cases correctly', function () {
        expect('n is 4 or n is not 6', 'to encode to', 'n === 4 || n !== 6');

        expect(' n  is  4  or  n  is  not  6 ', 'to encode to', 'n === 4 || n !== 6');
        expect('n within 2..4, 4..6', 'to encode to', 'n >= 2 && n <= 4 || n >= 4 && n <= 6');
        expect('n in 2..4, 4..6', 'to encode to', 'n === Math.floor(n) && (n >= 2 && n <= 4 || n >= 4 && n <= 6)');
        expect('n within 2, 4', 'to encode to', 'n === 2 || n === 4');
        expect('n is not 2', 'to encode to', 'n !== 2');
        expect('n mod 100 in 11..99', 'to encode to', 'n % 100 === Math.floor(n % 100) && n % 100 >= 11 && n % 100 <= 99');
    });
});
