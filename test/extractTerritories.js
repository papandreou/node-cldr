const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractTerritories', () => {
  let territories;
  before(() => {
    territories = cldr.extractTerritories();
  });

  it('should export an object with entries keyed by their ISO-3166-1 alpha-2 code, and all having the "alpha2Code" property', () => {
    expect(territories, 'to have keys satisfying', /[A-Z]{2,2}/);

    Object.keys(territories).forEach((territoryId) => {
      expect(territoryId, 'to be', territories[territoryId].alpha2Code);
    });
  });

  describe('for territories with alpha3 and numeric code', () => {
    it('should export the alpha3Code and numericCode properties as strings', () => {
      expect(territories.US, 'to satisfy', {
        alpha3Code: 'USA',
        numericCode: '840',
      });
    });

    it('should include zero-padding for territories with a numeric code lower than 100', () => {
      expect(territories.AT, 'to satisfy', {
        numericCode: '040',
      });
    });
  });

  describe('for territories without alpha3 or without numeric code', () => {
    it('should not expose the numericCode or alpha3Code properties', () => {
      // Picked IC (Canary Islands) which currently has neither
      expect(territories.IC, 'not to have properties', [
        'numericCode',
        'alpha3Code',
      ]);
    });
  });

  it('should include historical territories as well as current - Burma and Myanmar', () => {
    expect(territories, 'to satisfy', {
      BU: {
        numericCode: '104',
        alpha3Code: 'BUR',
      },
      MM: {
        numericCode: '104',
        alpha3Code: 'MMR',
      },
    });
  });
});
