const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('cldr.extractDateIntervalFormats("en")', () => {
  const englishDateIntervalFormats = cldr.extractDateIntervalFormats('en');
  it('should extract the correct formats', () => {
    expect(englishDateIntervalFormats, 'to equal', {
      Bh: { B: 'h B – h B', h: 'h – h B' },
      Bhm: { B: 'h:mm B – h:mm B', h: 'h:mm – h:mm B', m: 'h:mm – h:mm B' },
      H: {
        H: 'HH – HH',
      },
      Hm: {
        H: 'HH:mm – HH:mm',
        m: 'HH:mm – HH:mm',
      },
      Hmv: {
        H: 'HH:mm – HH:mm v',
        m: 'HH:mm – HH:mm v',
      },
      Hv: {
        H: 'HH – HH v',
      },
      M: {
        M: 'M – M',
      },
      MEd: {
        M: 'E, M/d – E, M/d',
        d: 'E, M/d – E, M/d',
      },
      MMM: {
        M: 'MMM – MMM',
      },
      MMMEd: {
        M: 'E, MMM d – E, MMM d',
        d: 'E, MMM d – E, MMM d',
      },
      MMMd: {
        M: 'MMM d – MMM d',
        d: 'MMM d – d',
      },
      Md: {
        M: 'M/d – M/d',
        d: 'M/d – M/d',
      },
      d: {
        d: 'd – d',
      },
      Gy: { G: 'y G – y G', y: 'y – y G' },
      GyM: {
        G: 'M/y GGGGG – M/y GGGGG',
        M: 'M/y – M/y GGGGG',
        y: 'M/y – M/y GGGGG',
      },
      GyMd: {
        d: 'M/d/y – M/d/y GGGGG',
        G: 'M/d/y GGGGG – M/d/y GGGGG',
        M: 'M/d/y – M/d/y GGGGG',
        y: 'M/d/y – M/d/y GGGGG',
      },
      GyMEd: {
        d: 'E, M/d/y – E, M/d/y GGGGG',
        G: 'E, M/d/y GGGGG – E, M/d/y GGGGG',
        M: 'E, M/d/y – E, M/d/y GGGGG',
        y: 'E, M/d/y – E, M/d/y GGGGG',
      },
      GyMMM: {
        G: 'MMM y G – MMM y G',
        M: 'MMM – MMM y G',
        y: 'MMM y – MMM y G',
      },
      GyMMMd: {
        d: 'MMM d – d, y G',
        G: 'MMM d, y G – MMM d, y G',
        M: 'MMM d – MMM d, y G',
        y: 'MMM d, y – MMM d, y G',
      },
      GyMMMEd: {
        d: 'E, MMM d – E, MMM d, y G',
        G: 'E, MMM d, y G – E, MMM d, y G',
        M: 'E, MMM d – E, MMM d, y G',
        y: 'E, MMM d, y – E, MMM d, y G',
      },
      h: {
        a: 'h a – h a',
        h: 'h – h a',
      },
      hm: {
        a: 'h:mm a – h:mm a',
        h: 'h:mm – h:mm a',
        m: 'h:mm – h:mm a',
      },
      hmv: {
        a: 'h:mm a – h:mm a v',
        h: 'h:mm – h:mm a v',
        m: 'h:mm – h:mm a v',
      },
      hv: {
        a: 'h a – h a v',
        h: 'h – h a v',
      },
      y: {
        y: 'y – y',
      },
      yM: {
        M: 'M/y – M/y',
        y: 'M/y – M/y',
      },
      yMEd: {
        M: 'E, M/d/y – E, M/d/y',
        d: 'E, M/d/y – E, M/d/y',
        y: 'E, M/d/y – E, M/d/y',
      },
      yMMM: {
        M: 'MMM – MMM y',
        y: 'MMM y – MMM y',
      },
      yMMMEd: {
        M: 'E, MMM d – E, MMM d, y',
        d: 'E, MMM d – E, MMM d, y',
        y: 'E, MMM d, y – E, MMM d, y',
      },
      yMMMM: {
        M: 'MMMM – MMMM y',
        y: 'MMMM y – MMMM y',
      },
      yMMMd: {
        M: 'MMM d – MMM d, y',
        d: 'MMM d – d, y',
        y: 'MMM d, y – MMM d, y',
      },
      yMd: {
        M: 'M/d/y – M/d/y',
        d: 'M/d/y – M/d/y',
        y: 'M/d/y – M/d/y',
      },
    });
  });
});
