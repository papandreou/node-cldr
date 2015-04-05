var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractFields', function () {
    it('should extract the British English fields correctly', function () {
        var britishFields = cldr.extractFields('en_GB');

        expect(britishFields, 'to only have keys', [
            'dayperiod',
            'era',
            'year',
            'year-short',
            'quarter',
            'quarter-short',
            'month',
            'month-short',
            'week',
            'week-short',
            'day',
            'day-short',
            'weekday',
            'hour',
            'hour-short',
            'minute',
            'minute-short',
            'second',
            'second-short',
            'zone',
            'sun',
            'sun-short',
            'sun-narrow',
            'mon',
            'mon-short',
            'mon-narrow',
            'tue',
            'tue-short',
            'tue-narrow',
            'wed',
            'wed-short',
            'wed-narrow',
            'thu',
            'thu-short',
            'thu-narrow',
            'fri',
            'fri-short',
            'fri-narrow',
            'sat',
            'sat-short',
            'sat-narrow'
        ]);
        expect(britishFields.dayperiod, 'to equal', {displayName: 'a.m./p.m.'});
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
