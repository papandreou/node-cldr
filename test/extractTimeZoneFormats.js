const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractTimeZoneFormats', () => {
  it('should extract the British English patterns correctly', () => {
    const britishTimeZoneFormats = cldr.extractTimeZoneFormats('en_GB');
    expect(britishTimeZoneFormats, 'to only have keys', [
      'hour',
      'gmt',
      'gmtZero',
      'region',
      'fallback',
      'regions',
    ]);
    expect(britishTimeZoneFormats.hour, 'to equal', ['+HH:mm', '-HH:mm']);
    expect(britishTimeZoneFormats.gmt, 'to equal', 'GMT{0}');
    expect(britishTimeZoneFormats.gmtZero, 'to equal', 'GMT');
    expect(britishTimeZoneFormats.region, 'to equal', '{0} Time');
    expect(britishTimeZoneFormats.fallback, 'to equal', '{1} ({0})');
    expect(britishTimeZoneFormats.regions, 'to only have keys', [
      'daylight',
      'standard',
    ]);
    expect(
      britishTimeZoneFormats.regions.daylight,
      'to equal',
      '{0} Daylight Time'
    );
    expect(
      britishTimeZoneFormats.regions.standard,
      'to equal',
      '{0} Standard Time'
    );
  });
});
