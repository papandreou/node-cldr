var expect = require('unexpected')
  .clone()
  .use(require('unexpected-function-equality'));

var cldr = require('../lib/cldr');

describe('extractPluralClasses', function() {
  it('should list three cardinal plural classes for Romanian', function() {
    let romanianPluralClasses = cldr.extractPluralClasses('ro');
    expect(romanianPluralClasses, 'to equal', ['one', 'few', 'other']);
  });

  it('should list two ordinal plural classes for Romanian', function() {
    let romanianPluralClasses = cldr.extractPluralClasses('ro', 'ordinal');
    expect(romanianPluralClasses, 'to equal', ['one', 'other']);
  });

  it('should list only one class for Yoruba', function() {
    let yorubanPluralClasses = cldr.extractPluralClasses('yo');
    expect(yorubanPluralClasses, 'to equal', ['other']);
  });
});
