const expect = require('unexpected');
const cldr = require('../lib/cldr');

const localeLessExtractors = new Set([
  'extractWindowsZonesByTimeZone',
  'extractWindowsZonesByName',
  'extractTerritories',
  'extractTerritoryInfo',
  'extractTerritoryContainmentGroups',
  'extractTerritoryAliases',
  'extractSubdivisionContainmentGroups',
  'extractSubdivisionAliases',
  'extractLanguageSupplementalData',
  'extractLanguageSupplementalMetadata',
  'extractNumberingSystem',
  'extractDigitsByNumberSystemId',
  'extractWeekData',
]);

describe('cldr', function () {
  describe('with invalid locale ids', function () {
    for (const propertyName in cldr) {
      if (
        /^extract/.test(propertyName) &&
        typeof cldr[propertyName] === 'function' &&
        !localeLessExtractors.has(propertyName)
      ) {
        describe(propertyName, function () {
          it('should disallow extracting from a non-existent top-level locale', function () {
            expect(
              () => cldr[propertyName]('foobarquux'),
              'to throw',
              'No data for locale id: foobarquux'
            );
          });

          it('should disallow extracting from a non-existent sublocale', function () {
            expect(
              () => cldr[propertyName]('da_foobarquux'),
              'to throw',
              'No data for locale id: da_foobarquux'
            );
          });
        });
      }
    }
  });
});
