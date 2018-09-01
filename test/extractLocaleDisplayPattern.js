var expect = require('unexpected');

var cldr = require('../lib/cldr');

describe('extractLocaleDisplayPattern', function() {
  it('should extract the British English patterns correctly', function() {
    var britishLocaleDisplayPatterns = cldr.extractLocaleDisplayPattern(
      'en_GB'
    );
    expect(britishLocaleDisplayPatterns, 'to only have keys', [
      'localePattern',
      'localeSeparator',
      'localeKeyTypePattern'
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
