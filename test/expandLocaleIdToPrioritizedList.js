var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('cldr.expandLocaleIdToPrioritizedList("en_GB")', function () {
    it('should return a list of locales with the first locale being "en_GB"', function () {
        expect(cldr.expandLocaleIdToPrioritizedList('en_GB')[0], 'to be', 'en_gb');
    });

    it('should have the parent locale "en_001" as the second locale in the returned list (as specified in supplementalData.xml)', function () {
        expect(cldr.expandLocaleIdToPrioritizedList('en_GB')[1], 'to be', 'en_001');
    });

    it('should have the generic locale "en" as the third locale in the returned list', function () {
        expect(cldr.expandLocaleIdToPrioritizedList('en_GB')[2], 'to be', 'en');
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
