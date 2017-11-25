var expect = require('unexpected');
var cldr = require('../lib/cldr');

describe('extractTerritoryInfo', function () {
    it('should extract basic information about Germany', function () {
        expect(cldr.extractTerritoryInfo(), 'to satisfy', {
            DE: {
                id: 'DE',
                gdp: expect.it('to be a number').and('to be greater than', 2000000000000),
                literacyPercent: expect.it('to be a number').and('to be greater than', 95),
                population: expect.it('to be a number').and('to be greater than', 70000000),
                languages: expect.it('to have an item exhaustively satisfying', {
                    id: 'de',
                    populationPercent: expect.it('to be a number'),
                    officialStatus: 'official'
                }).and('to have an item exhaustively satisfying', {
                    id: 'fr',
                    populationPercent: expect.it('to be a number')
                })
            }
        });
    });
});
