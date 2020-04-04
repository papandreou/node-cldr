const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('cldr.extractWeekData()', () => {
  it('should extract arrays of data', () => {
    expect(cldr.extractWeekData(), 'to have keys', [
      'minDays',
      'firstDay',
      'weekendStart',
      'weekendEnd',
      'weekOfPreference',
    ]);
  });

  it('should include exactly one default', () => {
    expect(
      cldr
        .extractWeekData()
        .minDays.filter((x) => x.territories.includes('001')),
      'to have length',
      1
    );
    expect(
      cldr
        .extractWeekData()
        .weekendStart.filter((x) => x.territories.includes('001')),
      'to have length',
      1
    );
    expect(
      cldr
        .extractWeekData()
        .weekOfPreference.filter((x) => x.locales.includes('und')),
      'to have length',
      1
    );
  });

  it('should include custom values for a territory', () => {
    expect(
      cldr.extractWeekData().firstDay.filter((x) => x.day === 'fri')[0]
        .territories,
      'to contain',
      'MV'
    );
    expect(
      cldr.extractWeekData().firstDay.filter((x) => x.day === 'sat')[0]
        .territories,
      'to contain',
      'AF'
    );
  });
});
