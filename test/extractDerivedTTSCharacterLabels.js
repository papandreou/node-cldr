const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractDerivedTTSCharacterLabels', () => {
  it('should extract the Australian English derived text-to-speech character labels correctly', () => {
    expect(cldr.extractDerivedTTSCharacterLabels('en_AU'), 'to satisfy', {
      '🖖🏽': 'Vulcan salute: medium skin tone',
      '🤙🏽': 'call-me hand: medium skin tone',
      '👋🏽': 'waving hand: medium skin tone',
    });
  });
});
