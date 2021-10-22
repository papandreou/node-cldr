const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractTerritoryDisplayNames', () => {
  it('should export an object code - name dictionary', () => {
    const territories = cldr.extractTerritoryDisplayNames('en');
    expect(territories, 'to have keys satisfying', /[A-Z0-9]{2,3}/);
  });

  it('should contain localized names', () => {
    const territoriesEn = cldr.extractTerritoryDisplayNames('en');
    const territoriesSv = cldr.extractTerritoryDisplayNames('sv');
    expect(territoriesEn.MK, 'to equal', 'North Macedonia');
    expect(territoriesSv.MK, 'to equal', 'Nordmakedonien');
  });

  it('should include the -alt-short and -alt-variant names', function () {
    const territoriesEn = cldr.extractTerritoryDisplayNames('en');
    expect(territoriesEn, 'to satisfy', {
      UN: 'United Nations',
      'UN-alt-short': 'UN',
      US: 'United States',
      'US-alt-short': 'US',
      'FK-alt-variant': 'Falkland Islands (Islas Malvinas)',
    });
  });
});
