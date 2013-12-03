var unexpected = require('unexpected'),
    uglifyJs = require('uglify-js'),
    CldrPluralRuleSet = require('../lib/CldrPluralRuleSet');

describe('CldrPluralRuleSet', function () {
    var expect = unexpected.clone();

    expect.addAssertion('to encode to', function (value) {
        var cldrPluralRuleSet = new CldrPluralRuleSet();
        Object.keys(this.obj).forEach(function (count) {
            cldrPluralRuleSet.addRule(this.obj[count], count);
        }, this);
        var beautifiedFunction = uglifyJs.uglify.gen_code(['toplevel', [['stat', ['function', null, ['n'], cldrPluralRuleSet.toJavaScriptFunctionBodyAst()]]]], {beautify: true});
        if (typeof value === 'function') {
            value = uglifyJs.uglify.gen_code(uglifyJs.parser.parse('(' + value.toString() + ')'), {beautify: true});
        }
        expect(beautifiedFunction, 'to equal', value);
    });

    it('should encode some basic test cases correctly', function () {
        expect(
            {one: 'n is 4 or n is not 6'},
            'to encode to',
            function (n) {
                if (typeof n === 'string') n = parseInt(n, 10);
                if (n === 4 || n !== 6) return "one";
                return "other";
            }
        );

        expect(
            {},
            'to encode to',
            function (n) {
                return "other";
            }
        );

        expect(
            {
                one: 'i = 1 and v = 0 @integer 1',
                two: 'i = 2 and v = 0 @integer 2',
                many: 'v = 0 and n != 0..10 and n % 10 = 0'
            },
            'to encode to',
            function (n) {
                var i = Math.floor(Math.abs(n)),
                    v = n.toString().replace(/^[^.]*\.?/, '').length;
                if (typeof n === 'string') n = parseInt(n, 10);
                if (i === 1 && v === 0) return 'one';
                if (i === 2 && v === 0) return 'two';
                if (v === 0 && !(n >= 0 && n <= 10) && n % 10 === 0) return 'many';
                return 'other';
            }
        );
    });

    it('should encode the Danish plural rule function from CLDR 24 correctly', function () {
        expect(
            {
                one: 'n = 1 or t != 0 and i = 0,1 @integer 1 @decimal 0.1~1.6',
                other: ' @integer 0, 2~16, 100, 1000, 10000, 100000, 1000000, … @decimal 0.0, 2.0~3.4, 10.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, …'
            },
            'to encode to',
            function (n) {
                var i = Math.floor(Math.abs(n)),
                    t = parseInt(n.toString().replace(/^[^.]*\.?|0+$/g, ''), 10);
                if (typeof n === 'string') n = parseInt(n, 10);
                if (n === 1 || !(t === 0) && (i === 0 || i === 1)) return 'one';
                return 'other';
            }
        );
    });

    it('should encode the Lativian plural rule function from CLDR 24 correctly', function () {
        expect(
            {
                zero: 'n % 10 = 0 or n % 100 = 11..19 or v = 2 and f % 100 = 11..19 @integer 0, 10~20, 30, 40, 50, 60, 100, 1000, 10000, 100000, 1000000, … @decimal 0.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, …',
                one: 'n % 10 = 1 and n % 100 != 11 or v = 2 and f % 10 = 1 and f % 100 != 11 or v != 2 and f % 10 = 1 @integer 1, 21, 31, 41, 51, 61, 71, 81, 101, 1001, … @decimal 0.1, 1.0, 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 10.1, 100.1, 1000.1, …',
                other: ' @integer 2~9, 22~29, 102, 1002, … @decimal 0.2~0.9, 1.2~1.9, 10.2, 100.2, 1000.2, …'
            },
            'to encode to',
            function (n) {
                var v = n.toString().replace(/^[^.]*\.?/, '').length,
                    f = parseInt(n.toString().replace(/^[^.]*\.?/, ''), 10);
                if (typeof n === 'string') n = parseInt(n, 10);
                if (n % 10 === 0 || (n % 100 >= 11 && n % 100 <= 19) || v === 2 && (f % 100 >= 11 && f % 100 <= 19)) return 'zero';
                if (n % 10 === 1 && (!(n % 100 === 11) || v === 2 && f % 10 === 1 && (!(f % 100 === 11) || !(v === 2) && f % 10 === 1))) return 'one';
                return 'other';
            }
        );
    });
});
