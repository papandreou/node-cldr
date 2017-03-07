var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractLanguageDisplayNames', function () {
    it('should extract the American English patterns correctly, even when the locale id is specified unnormalized', function () {
        expect(cldr.extractLanguageDisplayNames('en-us'), 'to satisfy', {
            fur: 'Friulian',
            fy: 'Western Frisian'
        });
    });
});
