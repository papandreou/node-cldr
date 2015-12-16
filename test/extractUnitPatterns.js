var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractUnitPatterns', function () {
    it('should extract the British English patterns correctly', function () {
		var britishUnitPatterns = cldr.extractUnitPatterns('en_GB');
        expect(britishUnitPatterns, 'to only have keys', ['long', 'short', 'narrow']);
        expect(britishUnitPatterns.long, 'to only have keys', ['unit', 'compoundUnit']);
        expect(britishUnitPatterns.long.unit, 'to have keys', ['angleArcSecond', 'volumeLiter']);
        expect(britishUnitPatterns.long.unit.volumeLiter, 'to have keys', ['one', 'other']);
        expect(britishUnitPatterns.long.unit.volumeLiter.other, 'to equal', '{0} liters');

        expect(britishUnitPatterns.long.compoundUnit, 'to only have key', 'per');
        expect(britishUnitPatterns.short.compoundUnit.per, 'to equal', '{0}/{1}');
        expect(britishUnitPatterns.long.compoundUnit.per, 'to equal', '{0} per {1}');
    });

    it('should throw when attempting to extract from a non-existent top-level locale', function () {
        expect(function () {
            cldr.extractUnitPatterns('foobarquux');
        }, 'to throw', 'No data for locale id: foobarquux');
    });

    it('should allow extracting a non-existent sublocale', function () {
        expect(function () {
            cldr.extractUnitPatterns('da_foobarquux');
        }, 'not to throw');
    });
});
