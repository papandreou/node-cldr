const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('cldr.extractDayNames("en")', () => {
  const englishDayNames = cldr.extractDayNames('en');
  it('should have the correct names', () => {
    expect(englishDayNames.format, 'to equal', {
      wide: [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ],

      abbreviated: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

      short: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],

      // Aliased to ../../dayContext[@type='stand-alone']/dayWidth[@type='narrow']
      narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    });

    expect(englishDayNames.standAlone, 'to equal', {
      // Aliased to: ../../dayContext[@type='format']/dayWidth[@type='wide']
      wide: [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ],

      // Aliased to ../../dayContext[@type='format']/dayWidth[@type='abbreviated']
      abbreviated: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

      // Aliased to: ../../dayContext[@type='format']/dayWidth[@type='short']
      short: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],

      narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    });
  });
});
