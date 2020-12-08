const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractUnitPatterns', () => {
  it('should extract the British English patterns correctly', () => {
    const britishUnitPatterns = cldr.extractUnitPatterns('en_GB');
    expect(britishUnitPatterns, 'to only have keys', [
      'long',
      'short',
      'narrow',
    ]);
    expect(britishUnitPatterns.long, 'to only have keys', [
      'unit',
      'compoundUnit',
    ]);
    expect(britishUnitPatterns.long.unit, 'to have keys', [
      'angleArcSecond',
      'volumeLiter',
    ]);
    expect(britishUnitPatterns.long.unit.volumeLiter, 'to have keys', [
      'one',
      'other',
    ]);
    expect(
      britishUnitPatterns.long.unit.volumeLiter.other,
      'to equal',
      '{0} litres'
    );

    expect(britishUnitPatterns.long.compoundUnit, 'to have keys', [
      'per',
      'times',
    ]);
    expect(britishUnitPatterns.short.compoundUnit.per, 'to equal', '{0}/{1}');
    expect(
      britishUnitPatterns.long.compoundUnit.per,
      'to equal',
      '{0} per {1}'
    );
  });
});
