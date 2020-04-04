const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractFields', () => {
  it('should extract the British English fields correctly', () => {
    const britishFields = cldr.extractFields('en_GB');

    expect(britishFields, 'to have keys', [
      'day',
      'day-short',
      'dayOfYear',
      'dayOfYear-short',
      'dayperiod',
      'dayperiod-short',
      'era',
      'era-short',
      'fri',
      'fri-narrow',
      'fri-short',
      'hour',
      'hour-narrow',
      'hour-short',
      'minute',
      'minute-narrow',
      'minute-short',
      'mon',
      'mon-narrow',
      'mon-short',
      'month',
      'month-narrow',
      'month-short',
      'quarter',
      'quarter-narrow',
      'quarter-short',
      'sat',
      'sat-narrow',
      'sat-short',
      'second',
      'second-narrow',
      'second-short',
      'sun',
      'sun-narrow',
      'sun-short',
      'thu',
      'thu-narrow',
      'thu-short',
      'tue',
      'tue-narrow',
      'tue-short',
      'wed',
      'wed-narrow',
      'wed-short',
      'week',
      'week-narrow',
      'week-short',
      'weekday-short',
      'weekdayOfMonth',
      'weekdayOfMonth-short',
      'weekOfMonth',
      'weekOfMonth-short',
      'weekday',
      'year',
      'year-narrow',
      'year-short',
      'zone',
      'zone-short',
    ]);
    expect(britishFields.dayperiod, 'to equal', { displayName: 'am/pm' });
    expect(britishFields.sat, 'to equal', {
      relative: {
        0: 'this Saturday',
        1: 'next Saturday',
        '-1': 'last Saturday',
      },
      relativeTime: {
        future: { one: 'in {0} Saturday', other: 'in {0} Saturdays' },
        past: { one: '{0} Saturday ago', other: '{0} Saturdays ago' },
      },
    });

    expect(britishFields.week, 'to equal', {
      displayName: 'week',
      relative: {
        0: 'this week',
        1: 'next week',
        '-1': 'last week',
      },
      relativeTime: {
        future: {
          one: 'in {0} week',
          other: 'in {0} weeks',
        },
        past: {
          one: '{0} week ago',
          other: '{0} weeks ago',
        },
      },
    });
  });
});
