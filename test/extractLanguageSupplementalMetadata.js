const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractLanguageSupplementalMetadata', () => {
  it('should return an object with locale ids as keys and objects as values', () => {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      no: {},
      glv: {}
    });
  });
  it('should return a reason', () => {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      no: { replacement: 'nb' }
    });
  });
  it('should return a replacement', () => {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      no: { reason: 'legacy' }
    });
  });
});
