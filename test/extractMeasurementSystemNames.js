var expect = require('unexpected');

var cldr = require('../lib/cldr');

describe('extractMeasurementSystemNames', function() {
  it('should extract the British English measurement systems correctly', function() {
    var britishMeasurementSystemNames = cldr.extractMeasurementSystemNames(
      'en_GB'
    );
    expect(britishMeasurementSystemNames, 'to only have keys', [
      'metric',
      'UK',
      'US'
    ]);
    expect(britishMeasurementSystemNames.metric, 'to equal', 'Metric');
    expect(britishMeasurementSystemNames.UK, 'to equal', 'UK');
    expect(britishMeasurementSystemNames.US, 'to equal', 'US');
  });
});
