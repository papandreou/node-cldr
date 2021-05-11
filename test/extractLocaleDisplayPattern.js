const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractLocaleDisplayPattern', () => {
  it('should extract the British English patterns correctly', () => {
    const britishLocaleDisplayPatterns =
      cldr.extractLocaleDisplayPattern('en_GB');
    expect(britishLocaleDisplayPatterns, 'to only have keys', [
      'localePattern',
      'localeSeparator',
      'localeKeyTypePattern',
    ]);
    expect(britishLocaleDisplayPatterns.localePattern, 'to equal', '{0} ({1})');
    expect(
      britishLocaleDisplayPatterns.localeSeparator,
      'to equal',
      '{0}, {1}'
    );
    expect(
      britishLocaleDisplayPatterns.localeKeyTypePattern,
      'to equal',
      '{0}: {1}'
    );
  });
});
