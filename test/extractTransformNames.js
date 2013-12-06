var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractTransformNames', function () {
    it('should extract the British English transform names correctly', function () {
        var britishTransformNames = cldr.extractTransformNames('en_GB');
        // Just name a few of the keys
        expect(britishTransformNames, 'to have keys', ['BGN', 'Numeric', 'x-Fullwidth']);
        expect(britishTransformNames.BGN, 'to equal', 'BGN');
        expect(britishTransformNames.Numeric, 'to equal', 'Numeric');
        expect(britishTransformNames['x-Fullwidth'], 'to equal', 'Fullwidth');
    });
});
