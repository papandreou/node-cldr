var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractFields', function () {
    it('should extract the British English fields correctly', function () {
        var britishFields = cldr.extractFields('en_GB');
        expect(britishFields, 'to only have keys', ['dayperiod', 'era', 'year', 'month', 'week', 'day', 'weekday', 'hour', 'minute', 'second', 'zone', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
        expect(britishFields.dayperiod, 'to equal', {displayName: 'am/pm'});
        expect(britishFields.sat, 'to equal', {
            relative: {
                0: 'this Saturday',
                1: 'next Saturday',
                '-1': 'last Saturday'
            }
        });

        expect(britishFields.week, 'to equal', {
            displayName: 'Week',
            relative: {
                0: 'this week',
                1: 'next week',
                '-1': 'last week'
            },
            relativeTime: {
                future: {
                    one: 'in {0} week',
                    other: 'in {0} weeks'
                },
                past: {
                    one: '{0} week ago',
                    other: '{0} weeks ago'
                }
            }
        });
    });
});
