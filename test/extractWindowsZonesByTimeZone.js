var expect = require('unexpected');
var cldr = require('../lib/cldr');

describe('extractWindowsZonesByTimeZone', function() {
  it('should foo', function() {
    expect(
      cldr.extractWindowsZonesByTimeZone('Vladivostok Standard Time'),
      'to satisfy',
      [
        {
          name: 'Asia/Vladivostok',
          territory: '001',
          timeZone: 'Vladivostok Standard Time'
        },
        {
          name: 'Asia/Vladivostok',
          territory: 'RU',
          timeZone: 'Vladivostok Standard Time'
        },
        {
          name: 'Asia/Ust-Nera',
          territory: 'RU',
          timeZone: 'Vladivostok Standard Time'
        }
      ]
    );
  });
});
