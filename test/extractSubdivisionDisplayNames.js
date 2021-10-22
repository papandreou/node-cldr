const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractSubdivisionDisplayNames', () => {
  const subdivisionsEn = cldr.extractSubdivisionDisplayNames('en');
  const subdivisionsSv = cldr.extractSubdivisionDisplayNames('sv');

  it('should export an object code - name dictionary', () => {
    expect(subdivisionsEn, 'to have keys satisfying', /[A-Za-z0-9]{1,4}/);
  });

  it('should contain localized named', () => {
    expect(subdivisionsEn.dk85, 'to equal', 'Zealand');
    expect(subdivisionsSv.dk85, 'to equal', 'Region Själland');
  });
});
