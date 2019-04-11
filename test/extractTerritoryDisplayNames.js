const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractTerritoryDisplayNames', () => {

  it('should export an object code - name dictionary', () => {
    const territories = cldr.extractTerritoryDisplayNames('en')
    expect(territories, 'to have keys satisfying', /[A-Z0-9]{2,3}/);
  });

  it('should contain localized named', () => {
    const territoriesEn = cldr.extractTerritoryDisplayNames('en')
    const territoriesSv = cldr.extractTerritoryDisplayNames('sv')
    expect(territoriesEn.MK, 'to equal', 'North Macedonia');
    expect(territoriesSv.MK, 'to equal', 'Nordmakedonien');
  });

});

describe('extractSubdivisionDisplayNames', () => {
  const subdivisionsEn = cldr.extractSubdivisionDisplayNames('en')
  const subdivisionsSv = cldr.extractSubdivisionDisplayNames('sv')

  it('should export an object code - name dictionay', () => {
    expect(subdivisionsEn, 'to have keys satisfying', /[A-Za-z0-9]{1,4}/);
  });

  it('should contain localized named', () => {
    expect(subdivisionsEn.dk85, 'to equal', 'Zealand');
    expect(subdivisionsSv.dk85, 'to equal', 'Region Själland');
  });

});
