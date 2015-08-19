var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractNumberPatterns', function () {
    it('should extract the British English patterns for latn number system correctly', function () {
		var britishNumberPatterns = cldr.extractNumberFormats('en_GB', 'latn');
        expect(britishNumberPatterns, 'to only have keys', ['scientific', 'decimal', 'currency', 'percent']);
        expect(britishNumberPatterns.scientific, 'to only have keys', ['default']);
        expect(britishNumberPatterns.scientific.default, 'to equal', '#E0');

        expect(britishNumberPatterns.decimal, 'to only have keys', ['long', 'short', 'default']);
        expect(britishNumberPatterns.decimal.long, 'to have keys', [1000, 10000, 100000]);
        expect(britishNumberPatterns.decimal.short, 'to have keys', [1000, 10000, 100000]);

        expect(britishNumberPatterns.currency, 'to only have keys', ['default', 'one', 'other', 'currencySpacing']);
        expect(britishNumberPatterns.currency.currencySpacing, 'to equal', {
            beforeCurrency: {
              currencyMatch: '[:^S:]',
              surroundingMatch: '[:digit:]',
              insertBetween: '\xa0'
            },
            afterCurrency: {
              currencyMatch: '[:^S:]',
              surroundingMatch: '[:digit:]',
              insertBetween: '\xa0'
            }
        });
    });
});
