const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractCodePatterns', () => {
  it('should extract the British English code patterns correctly', () => {
    const britishCodePatterns = cldr.extractCodePatterns('en_GB');
    expect(britishCodePatterns, 'to only have keys', [
      'language',
      'script',
      'territory',
    ]);
    expect(britishCodePatterns.language, 'to equal', 'Language: {0}');
    expect(britishCodePatterns.script, 'to equal', 'Script: {0}');
    expect(britishCodePatterns.territory, 'to equal', 'Region: {0}');
  });
});
