var unexpected = require('unexpected'),
    uglifyJs = require('uglify-js'),
    cldr = require('../lib/cldr');

function beautifyJavaScript(functionOrAst) {
    var ast;
    if (typeof functionOrAst === 'function') {
        ast = uglifyJs.parser.parse(functionOrAst.toString().replace(/^function \(/, 'function anonymous('));
    } else {
        ast = functionOrAst;
    }
    return uglifyJs.uglify.gen_code(ast, {beautify: true});
}

describe('extractRbnfFunctionByType', function () {
    var expect = unexpected.clone();
    expect.addAssertion('to have the same ast as', function (value) {
        expect(beautifyJavaScript(this.obj), 'to equal', beautifyJavaScript(value));
    });

    describe('#renderSpelloutCardinal', function () {
        describe('for Estonian', function () {
            var estonianRbnfFunctionByType = cldr.extractRbnfFunctionByType('et');

            it('should generate the correct code for the renderSpelloutCardinal rule', function () {
                expect(estonianRbnfFunctionByType.renderSpelloutCardinal, 'to have the same ast as', function (n) {
                    var isFractional = n !== Math.floor(n);
                    if (n < 0) return "miinus " + this.renderSpelloutCardinal(-n);
                    if (isFractional && n > 1) return this.renderSpelloutCardinal(Math.floor(n)) + " koma " + this.renderSpelloutCardinal(parseInt(String(n).replace(/\d*\./, ""), 10));
                    if (n >= 1e18) return this.renderNumber(n, "#,##0");
                    if (n >= 2e15) return this.renderSpelloutCardinal(Math.floor(n / 1e15)) + " biljardit" + (n === 2e15 ? "" : " " + this.renderSpelloutCardinal(n % 1e15));
                    if (n >= 1e15) return this.renderSpelloutCardinal(Math.floor(n / 1e15)) + " biljard" + (n === 1e15 ? "" : " " + this.renderSpelloutCardinal(n % 1e15));
                    if (n >= 2e12) return this.renderSpelloutCardinal(Math.floor(n / 1e12)) + " biljonit" + (n === 2e12 ? "" : " " + this.renderSpelloutCardinal(n % 1e12));
                    if (n >= 1e12) return this.renderSpelloutCardinal(Math.floor(n / 1e12)) + " biljon" + (n === 1e12 ? "" : " " + this.renderSpelloutCardinal(n % 1e12));
                    if (n >= 2e9) return this.renderSpelloutCardinal(Math.floor(n / 1e9)) + " miljardit" + (n === 2e9 ? "" : " " + this.renderSpelloutCardinal(n % 1e9));
                    if (n >= 1e9) return this.renderSpelloutCardinal(Math.floor(n / 1e9)) + " miljard" + (n === 1e9 ? "" : " " + this.renderSpelloutCardinal(n % 1e9));
                    if (n >= 2e6) return this.renderSpelloutCardinal(Math.floor(n / 1e6)) + " miljonit" + (n === 2e6 ? "" : " " + this.renderSpelloutCardinal(n % 1e6));
                    if (n >= 1e6) return this.renderSpelloutCardinal(Math.floor(n / 1e6)) + " miljon" + (n === 1e6 ? "" : " " + this.renderSpelloutCardinal(n % 1e6));
                    if (n >= 1e3) return this.renderSpelloutCardinal(Math.floor(n / 1e3)) + " tuhat" + (n === 1e3 ? "" : " " + this.renderSpelloutCardinal(n % 1e3));
                    if (n >= 100) return this.renderSpelloutCardinal(Math.floor(n / 100)) + "sada" + (n === 100 ? "" : " " + this.renderSpelloutCardinal(n % 100));
                    if (n >= 20) return this.renderSpelloutCardinal(Math.floor(n / 10)) + "kümmend" + (n === 20 ? "" : " " + this.renderSpelloutCardinal(n % 10));
                    if (n >= 11) return this.renderSpelloutCardinal(n % 10) + "teist";
                    if (n >= 10) return "kümme";
                    if (n >= 9) return "üheksa";
                    if (n >= 8) return "kaheksa";
                    if (n >= 7) return "seitse";
                    if (n >= 6) return "kuus";
                    if (n >= 5) return "viis";
                    if (n >= 4) return "neli";
                    if (n >= 3) return "kolm";
                    if (n >= 2) return "kaks";
                    if (n >= 1) return "üks";
                    if (n >= 0) return "null"
                });
            });

            it('should render the number 2439871 correctly (regression test for #12)', function () {
                expect(estonianRbnfFunctionByType.renderSpelloutCardinal(2439871), 'to equal', 'kaks miljonit nelisada kolmkümmend üheksa tuhat kaheksasada seitsekümmend üks');
            });
        });


        it('should render a number correctly in Danish', function () {
            var danishRbnfFunctionByType = cldr.extractRbnfFunctionByType('da_dk');
            danishRbnfFunctionByType.renderNumber = String;
            expect(danishRbnfFunctionByType.renderSpelloutNumbering(2439871).replace(/\u00ad/g, ''), 'to equal', 'to millioner og firehundred og niogtredive tusind og ottehundred og enoghalvfjerds');
        });
    });
});
