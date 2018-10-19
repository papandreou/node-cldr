var unexpected = require('unexpected');
var esprima = require('esprima');
var escodegen = require('escodegen');
var cldr = require('../lib/cldr');

function beautifyJavaScript(functionOrAst) {
  var ast;
  if (typeof functionOrAst === 'function') {
    ast = esprima.parse(
      functionOrAst.toString().replace(/^function \(/, 'function anonymous(')
    );
  } else {
    ast = functionOrAst;
  }
  return escodegen.generate(ast);
}

describe('extractRbnfFunctionByType', function() {
  var expect = unexpected.clone();
  expect.addAssertion('<function> to have the same ast as <function>', function(
    expect,
    subject,
    value
  ) {
    expect(beautifyJavaScript(subject), 'to equal', beautifyJavaScript(value));
  });

  describe('#renderSpelloutCardinal', function() {
    describe('for Estonian', function() {
      var estonianRbnfFunctionByType = cldr.extractRbnfFunctionByType('et');

      it('should generate the correct code for the renderSpelloutCardinal rule', function() {
        expect(
          estonianRbnfFunctionByType.renderSpelloutCardinal,
          'to have the same ast as',
          function(n) {
            /* eslint-disable */
            var isFractional = n !== Math.floor(n);
            if (n < 0) return 'miinus ' + this.renderSpelloutCardinal(-n);
            if (isFractional && n > 1)
              return (
                this.renderSpelloutCardinal(Math.floor(n)) +
                ' koma ' +
                this.renderSpelloutCardinal(
                  parseInt(String(n).replace(/\d*\./, ''), 10)
                )
              );
            if (n >= 1e18) return this.renderNumber(n, '#,##0');
            if (n >= 2e15)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e15)) +
                ' biljardit' +
                (n === 2e15 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e15))
              );
            if (n >= 1e15)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e15)) +
                ' biljard' +
                (n === 1e15 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e15))
              );
            if (n >= 2e12)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e12)) +
                ' biljonit' +
                (n === 2e12 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e12))
              );
            if (n >= 1e12)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e12)) +
                ' biljon' +
                (n === 1e12 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e12))
              );
            if (n >= 2e9)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e9)) +
                ' miljardit' +
                (n === 2e9 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e9))
              );
            if (n >= 1e9)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e9)) +
                ' miljard' +
                (n === 1e9 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e9))
              );
            if (n >= 2e6)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e6)) +
                ' miljonit' +
                (n === 2e6 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e6))
              );
            if (n >= 1e6)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e6)) +
                ' miljon' +
                (n === 1e6 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e6))
              );
            if (n >= 1e3)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e3)) +
                ' tuhat' +
                (n === 1e3 ? '' : ' ' + this.renderSpelloutCardinal(n % 1e3))
              );
            if (n >= 100)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 100)) +
                'sada' +
                (n === 100 ? '' : ' ' + this.renderSpelloutCardinal(n % 100))
              );
            if (n >= 20)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 10)) +
                'kümmend' +
                (n === 20 ? '' : ' ' + this.renderSpelloutCardinal(n % 10))
              );
            if (n >= 11) return this.renderSpelloutCardinal(n % 10) + 'teist';
            if (n >= 10) return 'kümme';
            if (n >= 9) return 'üheksa';
            if (n >= 8) return 'kaheksa';
            if (n >= 7) return 'seitse';
            if (n >= 6) return 'kuus';
            if (n >= 5) return 'viis';
            if (n >= 4) return 'neli';
            if (n >= 3) return 'kolm';
            if (n >= 2) return 'kaks';
            if (n >= 1) return 'üks';
            if (n >= 0) return 'null';
            /* eslint-enable */
          }
        );
      });

      it('should render the number 2439871 correctly (regression test for #12)', function() {
        expect(
          estonianRbnfFunctionByType.renderSpelloutCardinal(2439871),
          'to equal',
          'kaks miljonit nelisada kolmkümmend üheksa tuhat kaheksasada seitsekümmend üks'
        );
      });
    });

    it('should render a number correctly in Danish', function() {
      var danishRbnfFunctionByType = cldr.extractRbnfFunctionByType('da_dk');
      danishRbnfFunctionByType.renderNumber = String;
      expect(
        danishRbnfFunctionByType
          .renderSpelloutNumbering(2439871)
          .replace(/\u00ad/g, ''),
        'to equal',
        'to millioner firehundrede og niogtredive tusinde ottehundrede og enoghalvfjerds'
      );
    });

    // https://github.com/papandreou/node-cldr/issues/33
    it('should render ordinals correctly in American English', function() {
      var americanRbnfFunctionByType = cldr.extractRbnfFunctionByType('en_us');
      americanRbnfFunctionByType.renderNumber = String;
      expect(
        americanRbnfFunctionByType.renderDigitsOrdinal(1),
        'to equal',
        '1st'
      );
      expect(
        americanRbnfFunctionByType.renderDigitsOrdinal(2),
        'to equal',
        '2nd'
      );
      expect(
        americanRbnfFunctionByType.renderDigitsOrdinal(3),
        'to equal',
        '3rd'
      );
      expect(
        americanRbnfFunctionByType.renderDigitsOrdinal(4),
        'to equal',
        '4th'
      );
    });
  });
});
