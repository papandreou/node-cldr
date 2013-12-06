var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractListPatterns', function () {
    it('should extract the British English list patterns correctly', function () {
        var britishListPatterns = cldr.extractListPatterns('en_GB');
        expect(britishListPatterns, 'to only have keys', ['default', 'unit', 'unit-narrow', 'unit-short']);
        expect(britishListPatterns.default, 'to equal', {
            2: '{0} and {1}',
            start: '{0}, {1}',
            middle: '{0}, {1}',
            end: '{0} and {1}'
        });
    });
});
