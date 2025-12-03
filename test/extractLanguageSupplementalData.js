const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractLanguageSupplementalData', () => {
  it('should return an object with locale ids as keys and objects as values', () => {
    expect(cldr.extractLanguageSupplementalData(), 'to satisfy', {
      en: {},
      fr: {},
    });
  });

  it('should return a list of scripts for English', () => {
    expect(cldr.extractLanguageSupplementalData(), 'to satisfy', {
      en: {
        scripts: ['Latn'],
      },
    });
  });

  it('should return a list of secondary scripts for English', () => {
    expect(cldr.extractLanguageSupplementalData(), 'to satisfy', {
      en: {
        secondary: {
          scripts: ['Dsrt', 'Shaw'],
        },
      },
    });
  });

});
