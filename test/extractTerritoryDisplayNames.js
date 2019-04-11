const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractTerritoryDisplayNames', () => {

  it('should export an object code - name dictionay', () => {
    const territories = cldr.extractTerritoryDisplayNames('en')
    expect(territories, 'to have keys satisfying', /[A-Z0-9]{2,3}/);
  });

  it('should contain localized named', () => {
    const territories_en = cldr.extractTerritoryDisplayNames('en')
    const territories_sv = cldr.extractTerritoryDisplayNames('sv')
    expect(territories_en.MK, 'to equal', 'North Macedonia');
    expect(territories_sv.MK, 'to equal', 'Nordmakedonien');
  });

});

describe('extractSubdivisionDisplayNames', () => {
  const subdivisions_en = cldr.extractSubdivisionDisplayNames('en')
  const subdivisions_sv = cldr.extractSubdivisionDisplayNames('sv')

  it('should export an object code - name dictionay', () => {
    expect(subdivisions_en, 'to have keys satisfying', /[A-Za-z0-9]{1,4}/);
  });

  it('should contain localized named', () => {
    expect(subdivisions_en.dk85, 'to equal', 'Zealand');
    expect(subdivisions_sv.dk85, 'to equal', 'Region Själland');
  });

});
