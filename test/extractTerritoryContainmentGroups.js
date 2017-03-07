var expect = require('unexpected');
var cldr = require('../lib/cldr');

describe('extractTerritoryContainmentGroups', function () {
    var territoryContainmentGroups;
    before(function () {
        territoryContainmentGroups = cldr.extractTerritoryContainmentGroups();
    });

    it('contains group 029, which is a descendant of 019, which is a descendant of 001', function () {
        expect(territoryContainmentGroups, 'to have properties', ['029', '019', '001']);
    });

    it('only contains groups that are descendants of group 001', function () {
        expect(Object.keys(territoryContainmentGroups), 'to have items satisfying', function (index) {
            var item = territoryContainmentGroups[index];
            expect((index === '001' || (('parent' in item) && Boolean(item.parent))), 'to be', true);
        });
    });
});
