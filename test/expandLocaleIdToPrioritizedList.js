const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('cldr.expandLocaleIdToPrioritizedList("en_GB")', () => {
  it('should resolve the prioritized list correctly', () => {
    expect(cldr.expandLocaleIdToPrioritizedList('en-GB'), 'to equal', [
      'en_gb',
      'en_001',
      'en',
    ]);
  });
});

describe('cldr.expandLocaleIdToPrioritizedList("en-GB-oed")', () => {
  it('should resolve the prioritized list correctly', () => {
    expect(cldr.expandLocaleIdToPrioritizedList('en-GB-oed'), 'to equal', [
      'en_gb_oed',
      'en_gb',
      'en_001',
      'en',
    ]);
  });
});
