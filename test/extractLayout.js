var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractLayout', function () {
    it('should extract the Arabian layout', function () {
        expect(cldr.extractLayout('ar'), 'to equal', {
            orientation: {
                characterOrder: 'right-to-left',
                lineOrder: 'top-to-bottom'
            }
        });
    });

    it('should extract the American English layout', function () {
        expect(cldr.extractLayout('en_US'), 'to equal', {
            orientation: {
                characterOrder: 'left-to-right',
                lineOrder: 'top-to-bottom'
            }
        });
    });
});
