const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractWindowsZonesByName', () => {
  it('should extract an entry', () => {
    expect(
      cldr.extractWindowsZonesByName('Antarctica/DumontDUrville'),
      'to satisfy',
      [
        {
          name: 'Antarctica/DumontDUrville',
          territory: 'AQ',
          timeZone: 'West Pacific Standard Time',
        },
      ]
    );
  });

  it('should find entries where the <mapZone type=...> mentions multiple time zones', () => {
    expect(cldr.extractWindowsZonesByName('Australia/Brisbane'), 'to satisfy', [
      {
        name: 'Australia/Brisbane',
        territory: '001',
        timeZone: 'E. Australia Standard Time',
      },
      {
        name: 'Australia/Brisbane',
        territory: 'AU',
        timeZone: 'E. Australia Standard Time',
      },
    ]);
  });
});
