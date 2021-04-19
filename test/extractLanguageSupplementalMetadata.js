const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractLanguageSupplementalMetadata', () => {
  it('should return an object with locale ids as keys and objects as values', () => {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      und_nynorsk: { replacement: 'und', reason: 'deprecated' },
      glv: {},
    });
  });

  it('should return a reason', () => {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      und_nynorsk: { replacement: 'und', reason: 'deprecated' },
    });
  });

  it('should return a replacement', () => {
    expect(cldr.extractLanguageSupplementalMetadata(), 'to satisfy', {
      no_nyn: { replacement: 'nn', reason: 'deprecated' },
    });
  });
});
