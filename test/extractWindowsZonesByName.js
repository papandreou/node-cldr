var expect = require('unexpected');
var cldr = require('../lib/cldr');

describe('extractWindowsZonesByName', function () {
    it('should extract an entry', function () {
        expect(cldr.extractWindowsZonesByName('Antarctica/DumontDUrville'), 'to satisfy', [
            { name: 'Antarctica/DumontDUrville', territory: 'AQ', timeZone: 'West Pacific Standard Time' }
        ]);
    });

    it('should find entries where the <mapZone type=...> mentions multiple time zones', function () {
        expect(cldr.extractWindowsZonesByName('Australia/Brisbane'), 'to satisfy', [
            { name: 'Australia/Brisbane', territory: '001', timeZone: 'E. Australia Standard Time' },
            { name: 'Australia/Brisbane', territory: 'AU', timeZone: 'E. Australia Standard Time' }
        ]);
    });
});
