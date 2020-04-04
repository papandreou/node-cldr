const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractLanguageDisplayNames', () => {
  it('should extract the American English patterns correctly, even when the locale id is specified unnormalized', () => {
    expect(cldr.extractLanguageDisplayNames('en-us'), 'to satisfy', {
      fur: 'Friulian',
      fy: 'Western Frisian',
    });
  });
});
