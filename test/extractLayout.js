const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractLayout', () => {
  it('should extract the Arabian layout', () => {
    expect(cldr.extractLayout('ar'), 'to equal', {
      orientation: {
        characterOrder: 'right-to-left',
        lineOrder: 'top-to-bottom',
      },
    });
  });

  it('should extract the American English layout', () => {
    expect(cldr.extractLayout('en_US'), 'to equal', {
      orientation: {
        characterOrder: 'left-to-right',
        lineOrder: 'top-to-bottom',
      },
    });
  });
});
