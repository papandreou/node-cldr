const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('cldr.resolveParentLocaleId', () => {
  it('should use the data in supplementalData.xml to resolve the parent locale id', () => {
    expect(cldr.resolveParentLocaleId('en_gb'), 'to equal', 'en_001');
  });

  it("should normalize a locale id and correctly resolve it's parent", () => {
    expect(cldr.resolveParentLocaleId('en-GB'), 'to equal', 'en_001');
  });

  it("should fallback to stripping away the last underscore/hyphen if a locale id's parent is not found in supplementalData.xml", () => {
    expect(cldr.resolveParentLocaleId('en_gb_oed'), 'to equal', 'en_gb');
    expect(cldr.resolveParentLocaleId('en-GB-oed'), 'to equal', 'en_gb');
  });
});
