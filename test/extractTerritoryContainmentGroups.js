var expect = require('unexpected');
var cldr = require('../lib/cldr');

describe('extractTerritoryContainmentGroups', function () {
	var territoryContainmentGroups;
	before(function () {
		territoryContainmentGroups = cldr.extractTerritoryContainmentGroups();
	});

	it('does not contain the group 419, which is no direct descendant of world 001', function () {
		expect(territoryContainmentGroups, 'not to have property', '419');
	});

	it('contains group 029, which is a descendant of 019, which is a descendant of 001', function () {
		expect(territoryContainmentGroups, 'to have properties', ['029', '019', '001']);
	});

	
});