const expect = require('unexpected')
  .clone()
  .use(require('unexpected-function-equality'));

const cldr = require('../lib/cldr');

describe('extractPluralClasses', () => {
  it('should list three cardinal plural classes for Romanian', () => {
    let romanianPluralClasses = cldr.extractPluralClasses('ro');
    expect(romanianPluralClasses, 'to equal', ['one', 'few', 'other']);
  });

  it('should list two ordinal plural classes for Romanian', () => {
    let romanianPluralClasses = cldr.extractPluralClasses('ro', 'ordinal');
    expect(romanianPluralClasses, 'to equal', ['one', 'other']);
  });

  it('should list only one class for Yoruba', () => {
    let yorubanPluralClasses = cldr.extractPluralClasses('yo');
    expect(yorubanPluralClasses, 'to equal', ['other']);
  });
});
