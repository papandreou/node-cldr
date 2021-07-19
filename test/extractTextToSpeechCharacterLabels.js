const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractTextToSpeechCharacterLabels', () => {
  it('should extract the Australian English text-to-speech character labels correctly', () => {
    expect(cldr.extractTextToSpeechCharacterLabels('en_AU'), 'to satisfy', {
      '🖖': 'Vulcan salute',
      '🤙': 'call-me hand',
      '👋': 'waving hand',
    });
  });
});
