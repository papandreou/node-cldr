var expect = require('unexpected');
var cldr = require('../lib/cldr');

it('should foo', function () {
	expect(cldr.extractWorldInfo(), 'to equal', require('../worldInfo.json'));
});
