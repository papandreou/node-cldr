const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('cldr.extractDateIntervalFormats("en")', () => {
  const englishDateIntervalFormats = cldr.extractDateIntervalFormats('en');
  it('should extract the correct formats', () => {
    expect(englishDateIntervalFormats, 'to equal', {
      Bh: { B: 'h B – h B', h: 'h – h B' },
      Bhm: { B: 'h:mm B – h:mm B', h: 'h:mm – h:mm B', m: 'h:mm – h:mm B' },
      d: { d: 'd – d' },
      Gy: { G: 'y G – y G', y: 'y – y G' },
      GyM: { G: 'M/y G – M/y G', M: 'M/y – M/y G', y: 'M/y – M/y G' },
      GyMd: {
        d: 'M/d/y – M/d/y G',
        G: 'M/d/y G – M/d/y G',
        M: 'M/d/y – M/d/y G',
        y: 'M/d/y – M/d/y G',
      },
      GyMEd: {
        d: 'E, M/d/y – E, M/d/y G',
        G: 'E, M/d/y G – E, M/d/y G',
        M: 'E, M/d/y – E, M/d/y G',
        y: 'E, M/d/y – E, M/d/y G',
      },
      GyMMM: {
        G: 'MMM y G – MMM y G',
        M: 'MMM – MMM y G',
        y: 'MMM y – MMM y G',
      },
      GyMMMd: {
        d: 'MMM d – d, y G',
        G: 'MMM d, y G – MMM d, y G',
        M: 'MMM d – MMM d, y G',
        y: 'MMM d, y – MMM d, y G',
      },
      GyMMMEd: {
        d: 'E, MMM d – E, MMM d, y G',
        G: 'E, MMM d, y G – E, MMM d, y G',
        M: 'E, MMM d – E, MMM d, y G',
        y: 'E, MMM d, y – E, MMM d, y G',
      },
      h: { a: 'h a – h a', h: 'h – h a' },
      H: { H: 'HH – HH' },
      hm: { a: 'h:mm a – h:mm a', h: 'h:mm – h:mm a', m: 'h:mm – h:mm a' },
      Hm: { H: 'HH:mm – HH:mm', m: 'HH:mm – HH:mm' },
      hmv: {
        a: 'h:mm a – h:mm a v',
        h: 'h:mm – h:mm a v',
        m: 'h:mm – h:mm a v',
      },
      Hmv: { H: 'HH:mm – HH:mm v', m: 'HH:mm – HH:mm v' },
      hv: { a: 'h a – h a v', h: 'h – h a v' },
      Hv: { H: 'HH – HH v' },
      M: { M: 'M – M' },
      Md: { d: 'M/d – M/d', M: 'M/d – M/d' },
      MEd: { d: 'E, M/d – E, M/d', M: 'E, M/d – E, M/d' },
      MMM: { M: 'MMM – MMM' },
      MMMd: { d: 'MMM d – d', M: 'MMM d – MMM d' },
      MMMEd: { d: 'E, MMM d – E, MMM d', M: 'E, MMM d – E, MMM d' },
      MMMMd: { d: 'MMMM d – d', M: 'MMMM d – MMMM d' },
      y: { y: 'y – y' },
      yM: { M: 'M/y – M/y', y: 'M/y – M/y' },
      yMd: { d: 'M/d/y – M/d/y', M: 'M/d/y – M/d/y', y: 'M/d/y – M/d/y' },
      yMEd: {
        d: 'E, M/d/y – E, M/d/y',
        M: 'E, M/d/y – E, M/d/y',
        y: 'E, M/d/y – E, M/d/y',
      },
      yMMM: { M: 'MMM – MMM y', y: 'MMM y – MMM y' },
      yMMMd: {
        d: 'MMM d – d, y',
        M: 'MMM d – MMM d, y',
        y: 'MMM d, y – MMM d, y',
      },
      yMMMEd: {
        d: 'E, MMM d – E, MMM d, y',
        M: 'E, MMM d – E, MMM d, y',
        y: 'E, MMM d, y – E, MMM d, y',
      },
      yMMMM: { M: 'MMMM – MMMM y', y: 'MMMM y – MMMM y' },
    });
  });
});
