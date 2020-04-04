const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractListPatterns', () => {
  it('should extract the British English list patterns correctly', () => {
    const britishListPatterns = cldr.extractListPatterns('en_GB');
    expect(britishListPatterns, 'to have keys', [
      'default',
      'unit',
      'unitNarrow',
      'unitShort',
      'standardShort',
    ]);
    expect(britishListPatterns.default, 'to satisfy', {
      2: '{0} and {1}',
      start: '{0}, {1}',
      middle: '{0}, {1}',
      end: '{0} and {1}',
    });
  });

  it('should extract the American English list patterns correctly', () => {
    const britishListPatterns = cldr.extractListPatterns('en_US');
    expect(britishListPatterns, 'to have keys', [
      'default',
      'unit',
      'unitNarrow',
      'unitShort',
    ]);
    expect(britishListPatterns.default, 'to satisfy', {
      2: '{0} and {1}',
      start: '{0}, {1}',
      middle: '{0}, {1}',
      end: '{0}, and {1}',
    });
  });
});
