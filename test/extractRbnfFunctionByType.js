const expect = require('unexpected').clone();
const esprima = require('esprima');
const escodegen = require('escodegen');
const cldr = require('../lib/cldr');
const sinon = require('sinon');

function beautifyJavaScript(functionOrAst) {
  let ast;
  if (typeof functionOrAst === 'function') {
    ast = esprima.parse(
      functionOrAst.toString().replace(/^function\s*\(/, 'function anonymous(')
    );
  } else {
    ast = functionOrAst;
  }
  return escodegen.generate(ast);
}

expect.addAssertion(
  '<function> to have the same ast as <function>',
  (expect, subject, value) => {
    expect(beautifyJavaScript(subject), 'to equal', beautifyJavaScript(value));
  }
);

describe('extractRbnfFunctionByType', () => {
  describe('#renderSpelloutCardinal', () => {
    describe('for Estonian', () => {
      const estonianRbnfFunctionByType = cldr.extractRbnfFunctionByType('et');

      it('should generate the correct code for the renderSpelloutCardinal rule', () => {
        expect(
          estonianRbnfFunctionByType.renderSpelloutCardinal,
          'to have the same ast as',
          function (n) {
            /* eslint-disable */
            const isFractional = n !== Math.floor(n);
            if (n < 0) return 'miinus ' + this.renderSpelloutCardinal(-n);
            if (isFractional)
              return (
                this.renderSpelloutCardinal(Math.floor(n)) +
                ' koma ' +
                String(n)
                  .replace(/\d*\./, '')
                  .split(/(?:)/)
                  .map(function (digit) {
                    return this.renderSpelloutCardinal(parseInt(digit));
                  }, this)
                  .join(' ')
              );
            if (n >= 1e18) return this.renderNumber(n, '#,##0');
            if (n >= 2e15)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e15)) +
                ' biljardit' +
                (n % 2e15 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e15))
              );
            if (n >= 1e15)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e15)) +
                ' biljard' +
                (n % 1e15 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e15))
              );
            if (n >= 2e12)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e12)) +
                ' biljonit' +
                (n % 2e12 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e12))
              );
            if (n >= 1e12)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e12)) +
                ' biljon' +
                (n % 1e12 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e12))
              );
            if (n >= 2e9)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e9)) +
                ' miljardit' +
                (n % 2e9 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e9))
              );
            if (n >= 1e9)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e9)) +
                ' miljard' +
                (n % 1e9 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e9))
              );
            if (n >= 2e6)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e6)) +
                ' miljonit' +
                (n % 2e6 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e6))
              );
            if (n >= 1e6)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e6)) +
                ' miljon' +
                (n % 1e6 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e6))
              );
            if (n >= 1e3)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 1e3)) +
                ' tuhat' +
                (n % 1e3 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 1e3))
              );
            if (n >= 100)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 100)) +
                'sada' +
                (n % 100 === 0
                  ? ''
                  : ' ' + this.renderSpelloutCardinal(n % 100))
              );
            if (n >= 20)
              return (
                this.renderSpelloutCardinal(Math.floor(n / 10)) +
                'kümmend' +
                (n % 20 === 0 ? '' : ' ' + this.renderSpelloutCardinal(n % 10))
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
            return 'null';
            /* eslint-enable */
          }
        );
      });

      it('should render the number 2439871 correctly (regression test for #12)', () => {
        expect(
          estonianRbnfFunctionByType.renderSpelloutCardinal(2439871),
          'to equal',
          'kaks miljonit nelisada kolmkümmend üheksa tuhat kaheksasada seitsekümmend üks'
        );
      });
    });

    it('should render a number correctly in Danish', () => {
      const danishRbnfFunctionByType = cldr.extractRbnfFunctionByType('da_dk');
      danishRbnfFunctionByType.renderNumber = String;
      expect(
        danishRbnfFunctionByType
          .renderSpelloutNumbering(2439871)
          .replace(/\u00ad/g, ''),
        'to equal',
        'to millioner firehundrede og niogtredive tusind ottehundrede og enoghalvfjerds'
      );
    });

    // https://github.com/papandreou/node-cldr/issues/33
    it('should render ordinals correctly in American English', () => {
      const americanRbnfFunctionByType =
        cldr.extractRbnfFunctionByType('en_us');
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

  // https://github.com/papandreou/node-cldr/issues/75
  describe('with a rule set that does not contain a -x rule', function () {
    it('should render a negative number correctly', function () {
      const swedishRbnfFunctionByType = cldr.extractRbnfFunctionByType('sv');
      swedishRbnfFunctionByType.renderNumber = String;
      expect(
        swedishRbnfFunctionByType.renderSpelloutCardinalNeuter(-3),
        'to equal',
        'minus tre'
      );
    });

    it('should produce the expected function', function () {
      const swedishRbnfFunctionByType = cldr.extractRbnfFunctionByType('sv');
      expect(
        swedishRbnfFunctionByType.renderSpelloutCardinalNeuter,
        'to have the same ast as',
        function (n) {
          return this.renderSpelloutNumbering(n);
        }
      );
    });
  });

  // https://github.com/papandreou/node-cldr/issues/76
  it('should render long Swedish spellout cardinals', function () {
    const swedishRbnfFunctionByType = cldr.extractRbnfFunctionByType('sv');
    expect(
      swedishRbnfFunctionByType.renderSpelloutCardinalNeuter(1800000),
      'to equal',
      'en miljon åtta\xadhundra\xadtusen'
    );
  });

  // https://github.com/papandreou/node-cldr/issues/102
  it('should use the x.x rule when there is a fractional part', function () {
    const renderers = cldr.extractRbnfFunctionByType('en_GB');
    expect(renderers.renderSpelloutCardinal(0.6), 'to equal', 'zero point six');
  });

  // https://github.com/papandreou/node-cldr/issues/102
  it('should interpret the x.x rule correctly', function () {
    const renderers = cldr.extractRbnfFunctionByType('en_GB');
    expect(
      renderers.renderSpelloutCardinal(2.0095),
      'to equal',
      'two point zero zero nine five'
    );
  });

  describe('with locales that have a non-latin default numbering system', function () {
    it('should support a numbering system with different digits', function () {
      const renderers = cldr.extractRbnfFunctionByType('ar');
      expect(renderers.renderDigitsOrdinal(3), 'to equal', '٣.');
    });

    it('should support an algorithmic numbering system', function () {
      // None of the locales in CLDR actually use one, so fake it:
      sinon
        .stub(cldr, 'extractDefaultNumberSystemId')
        .withArgs('ar')
        .returns('roman');
      try {
        const renderers = cldr.extractRbnfFunctionByType('ar');
        expect(renderers.renderDigitsOrdinal(3), 'to equal', 'III.');
      } finally {
        cldr.extractDefaultNumberSystemId.restore();
      }
    });
  });
});
