var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractFields', function () {
    it('should extract the British English fields correctly', function () {
		var britishFields = cldr.extractFields('en_GB');
        expect(britishFields, 'to only have keys', ['dayperiod', 'era', 'year', 'month', 'week', 'day', 'weekday', 'hour', 'minute', 'second', 'zone']);
        expect(britishFields.dayperiod, 'to equal', {displayName: 'am/pm'});
        expect(britishFields.week, 'to equal', {
            displayName: 'Week',
            relative: {
                0: 'This week',
                1: 'Next week',
                '-1': 'Last week'
            }
        });
    });
});
