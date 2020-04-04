const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('cldr.extractDateFormats("en_GB")', () => {
  it('should extract the correct British English date formats', () => {
    expect(cldr.extractDateFormats('en_GB'), 'to equal', {
      full: 'EEEE, d MMMM y',
      long: 'd MMMM y',
      medium: 'd MMM y',
      short: 'dd/MM/y',
    });
  });
});
