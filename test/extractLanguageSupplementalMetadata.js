var expect = require('unexpected');

var cldr = require('../lib/cldr');

describe('extractLanguageSupplementalMetadata', function() {
  it('should return an object with locale ids as keys and objects as values', function() {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      no: {},
      glv: {}
    });
  });
  it('should return a reason', function() {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      no: { replacement: 'nb' }
    });
  });
  it('should return a replacement', function() {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      no: { reason: 'legacy' }
    });
  });
});
