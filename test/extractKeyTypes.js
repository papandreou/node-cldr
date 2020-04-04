const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractKeyTypes', () => {
  it('should extract the British English keys and types correctly', () => {
    const britishKeyTypes = cldr.extractKeyTypes('en_GB');
    // Just name a few of the keys
    expect(britishKeyTypes, 'to have keys', [
      'calendar',
      'colNumeric',
      'numbers',
      'timezone',
      'x',
    ]);
    expect(britishKeyTypes.x, 'to only have keys', ['displayName']);
    expect(britishKeyTypes.x.displayName, 'to equal', 'Private-Use');
    expect(britishKeyTypes.colNumeric, 'to only have keys', [
      'displayName',
      'types',
    ]);
    expect(britishKeyTypes.colNumeric, 'to only have keys', [
      'displayName',
      'types',
    ]);
    expect(
      britishKeyTypes.colNumeric.displayName,
      'to equal',
      'Numeric Sorting'
    );
    expect(britishKeyTypes.colNumeric.types, 'to only have keys', [
      'no',
      'yes',
    ]);
    expect(
      britishKeyTypes.colNumeric.types.no,
      'to equal',
      'Sort Digits Individually'
    );
    expect(
      britishKeyTypes.colNumeric.types.yes,
      'to equal',
      'Sort Digits Numerically'
    );
  });
});
