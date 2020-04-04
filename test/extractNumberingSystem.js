const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractNumberingSystem', () => {
  it('should throw if the numbering system does not exist', () => {
    expect(
      () => cldr.extractNumberingSystem('foo'),
      'to error',
      'Unknown numbering system: foo'
    );
  });

  it('should extract a numeric (digits-based) numbering system', () => {
    expect(cldr.extractNumberingSystem('fullwide'), 'to equal', {
      type: 'numeric',
      digits: ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'],
    });
  });

  it('should extract digits with high codepoints', () => {
    expect(cldr.extractNumberingSystem('ahom'), 'to equal', {
      type: 'numeric',
      digits: ['𑜰', '𑜱', '𑜲', '𑜳', '𑜴', '𑜵', '𑜶', '𑜷', '𑜸', '𑜹'],
    });
  });

  it('should extract an algorithmic numbering system without a locale', () => {
    expect(cldr.extractNumberingSystem('ethi'), 'to equal', {
      type: 'algorithmic',
      rules: 'renderEthiopic',
    });
  });

  it('should extract an algorithmic numbering system with a locale', () => {
    expect(cldr.extractNumberingSystem('jpan'), 'to equal', {
      type: 'algorithmic',
      rules: 'renderSpelloutCardinal',
      locale: 'ja',
    });
  });

  it('should extract an algorithmic numbering system with a locale and a sublocale', () => {
    expect(cldr.extractNumberingSystem('hantfin'), 'to equal', {
      type: 'algorithmic',
      rules: 'renderSpelloutCardinalFinancial',
      locale: 'zh_Hant',
    });
  });
});
