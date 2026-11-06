const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractTimeZoneFormats', () => {
  it('should extract the British English patterns correctly', () => {
    const britishTimeZoneFormats = cldr.extractTimeZoneFormats('en_GB');
    expect(britishTimeZoneFormats, 'to only have keys', [
      'hour',
      'gmt',
      'region',
      'fallback',
      'regions',
    ]);
    expect(britishTimeZoneFormats.hour, 'to equal', ['+HH:mm', '-HH:mm']);
    expect(britishTimeZoneFormats.gmt, 'to equal', 'GMT{0}');
    expect(britishTimeZoneFormats.region, 'to equal', '{0} Time');
    expect(britishTimeZoneFormats.fallback, 'to equal', '{1} ({0})');
    expect(britishTimeZoneFormats.regions, 'to only have keys', [
      'daylight',
      'standard',
    ]);
    expect(
      britishTimeZoneFormats.regions.daylight,
      'to equal',
      '{0} Daylight Time',
    );
    expect(
      britishTimeZoneFormats.regions.standard,
      'to equal',
      '{0} Standard Time',
    );
  });

  // mt.xml only defines <gmtFormat alt="utc">, which must not shadow root's plain <gmtFormat>
  it('should not pick up alt variants of the gmt format', () => {
    expect(cldr.extractTimeZoneFormats('mt').gmt, 'to equal', 'GMT{0}');
  });
});
