const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractTTSCharacterLabels', () => {
  it('should extract the Australian English text-to-speech character labels correctly', () => {
    expect(cldr.extractTTSCharacterLabels('en_AU'), 'to satisfy', {
      '🖖': 'Vulcan salute',
      '🤙': 'call-me hand',
      '👋': 'waving hand',
    });
  });
});
