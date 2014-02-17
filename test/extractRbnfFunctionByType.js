var expect = require('unexpected'),
    cldr = require('../lib/cldr');

describe('extractRbnfFunctionByType', function () {
    describe('#renderSpelloutCardinal', function () {
        it('should render a number correctly in Estonian (regression test for #12)', function () {
            var estonianRbnfFunctionByType = cldr.extractRbnfFunctionByType('et');
            expect(estonianRbnfFunctionByType.renderSpelloutCardinal(2439871), 'to equal', 'kaks miljonit nelisada kolmkümmend üheksa tuhat kaheksasada seitsekümmend üks');
        });


        it.skip('should render a number correctly in Danish', function () {
            var danishRbnfFunctionByType = cldr.extractRbnfFunctionByType('da_dk');
            danishRbnfFunctionByType.renderNumber = String;
            expect(danishRbnfFunctionByType.renderSpelloutNumbering(2439871).replace(/\u00ad/g, ''), 'to equal', 'en millioner og ethundred og nitten tusind og firehundred og enoghalvfjerds');
        });
    });
});
