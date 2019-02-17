var expect = require('unexpected');

var cldr = require('../lib/cldr');

describe('extractNumberingSystem', function() {
  it('should throw if the numbering system does not exist', function() {
    expect(
      () => cldr.extractNumberingSystem('foo'),
      'to error',
      'Unknown numbering system: foo'
    );
  });

  it('should extract a numeric (digits-based) numbering system', function() {
    expect(cldr.extractNumberingSystem('fullwide'), 'to equal', {
      type: 'numeric',
      digits: ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９']
    });
  });

  it('should extract an algorithmic numbering system without a locale', function() {
    expect(cldr.extractNumberingSystem('ethi'), 'to equal', {
      type: 'algorithmic',
      rules: 'renderEthiopic'
    });
  });

  it('should extract an algorithmic numbering system with a locale', function() {
    expect(cldr.extractNumberingSystem('jpan'), 'to equal', {
      type: 'algorithmic',
      rules: 'renderSpelloutCardinal',
      locale: 'ja'
    });
  });

  it('should extract an algorithmic numbering system with a locale and a sublocale', function() {
    expect(cldr.extractNumberingSystem('hantfin'), 'to equal', {
      type: 'algorithmic',
      rules: 'renderSpelloutCardinalFinancial',
      locale: 'zh_Hant'
    });
  });
});
