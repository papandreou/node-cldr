var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractCodePatterns', function () {
    it('should extract the British English code patterns correctly', function () {
		var britishCodePatterns = cldr.extractCodePatterns('en_GB');
        expect(britishCodePatterns, 'to only have keys', ['language', 'script', 'territory']);
        expect(britishCodePatterns.language, 'to equal', 'Language: {0}');
        expect(britishCodePatterns.script, 'to equal', 'Script: {0}');
        expect(britishCodePatterns.territory, 'to equal', 'Region: {0}');
    });
});
