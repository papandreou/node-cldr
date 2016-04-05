var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('cldr.expandLocaleIdToPrioritizedList("en_GB")', function () {
    it('should resolve the prioritized list correctly', function () {
        expect(cldr.expandLocaleIdToPrioritizedList('en-GB'), 'to equal', [
            'en_gb',
            'en_001',
            'en'
        ]);
    });
});

describe('cldr.expandLocaleIdToPrioritizedList("en-GB-oed")', function () {
    it('should resolve the prioritized list correctly', function () {
        expect(cldr.expandLocaleIdToPrioritizedList('en-GB-oed'), 'to equal', [
            'en_gb_oed',
            'en_gb',
            'en_001',
            'en'
        ]);
    });
});
