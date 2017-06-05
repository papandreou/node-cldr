var expect = require('unexpected');
var cldr = require('../lib/cldr');

describe('extractTerritoryInfo', function () {
    it('should extract basic information about Germany', function () {
        expect(cldr.extractTerritoryInfo(), 'to satisfy', {
            DE: {
                id: 'DE',
                gdp: 3748000000000,
                literacyPercent: 99,
                population: 80854400,
                languages: expect.it('to have an item exhaustively satisfying', {
                    id: 'de',
                    populationPercent: 91,
                    officialStatus: 'official'
                }).and('to have an item exhaustively satisfying', {
                    id: 'fr',
                    populationPercent: 18
                })
            }
        });
    });
});
