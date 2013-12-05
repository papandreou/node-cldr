var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractUnitPatterns', function () {
    it('should extract the British English patterns correctly', function () {
		var britishUnitPatterns = cldr.extractUnitPatterns('en_GB');
        expect(britishUnitPatterns, 'to only have keys', ['unit', 'compoundUnit']);
        expect(britishUnitPatterns.unit, 'to only have keys', ['long', 'short', 'narrow']);
        expect(britishUnitPatterns.unit.long, 'to have keys', ['angleArcSecond', 'volumeLiter']);
        expect(britishUnitPatterns.unit.long.volumeLiter, 'to have keys', ['one', 'other']);
        expect(britishUnitPatterns.unit.long.volumeLiter.other, 'to equal', '{0} litres');

        expect(britishUnitPatterns.compoundUnit, 'to only have key', 'per');
        expect(britishUnitPatterns.compoundUnit.per, 'to equal', '{0}/{1}');
    });
});
