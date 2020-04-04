const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractWindowsZonesByTimeZone', () => {
  it('should extract Vladivostok Standard Time', () => {
    expect(
      cldr.extractWindowsZonesByTimeZone('Vladivostok Standard Time'),
      'to satisfy',
      [
        {
          name: 'Asia/Vladivostok',
          territory: '001',
          timeZone: 'Vladivostok Standard Time',
        },
        {
          name: 'Asia/Vladivostok',
          territory: 'RU',
          timeZone: 'Vladivostok Standard Time',
        },
        {
          name: 'Asia/Ust-Nera',
          territory: 'RU',
          timeZone: 'Vladivostok Standard Time',
        },
      ]
    );
  });
});
