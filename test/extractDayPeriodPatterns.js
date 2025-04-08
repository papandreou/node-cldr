const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractDayPeriodRules', () => {
  const dutchDayPeriodRules = cldr.extractDayPeriodRules('nl');
  it('should have the correct rules', () => {
    expect(dutchDayPeriodRules.standAlone, 'to equal', [
      { type: 'midnight', at: '00:00', from: '', before: '' },
      { type: 'morning1', at: '', from: '06:00', before: '12:00' },
      { type: 'afternoon1', at: '', from: '12:00', before: '18:00' },
      { type: 'evening1', at: '', from: '18:00', before: '24:00' },
      { type: 'night1', at: '', from: '00:00', before: '06:00' },
    ]);
    expect(dutchDayPeriodRules.format, 'to equal', [
      { type: 'morning1', at: '', from: '06:00', before: '12:00' },
      { type: 'afternoon1', at: '', from: '12:00', before: '18:00' },
      { type: 'evening1', at: '', from: '18:00', before: '24:00' },
      { type: 'night1', at: '', from: '00:00', before: '06:00' },
    ]);
  });
});
