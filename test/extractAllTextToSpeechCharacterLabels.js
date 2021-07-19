const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractAllTextToSpeechCharacterLabels', () => {
  it('should extract all the Australian English text-to-speech character labels correctly', () => {
    expect(cldr.extractAllTextToSpeechCharacterLabels('en_AU'), 'to satisfy', {
      '🖖': 'Vulcan salute',
      '🖖🏽': 'Vulcan salute: medium skin tone',
      '🤙': 'call-me hand',
      '🤙🏽': 'call-me hand: medium skin tone',
      '👋': 'waving hand',
      '👋🏽': 'waving hand: medium skin tone',
    });
  });
});
