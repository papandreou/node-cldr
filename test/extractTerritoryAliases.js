const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractTerritoryAliases', () => {
  let territoryAliases;
  before(() => {
    territoryAliases = cldr.extractTerritoryAliases();
  });

  it('contains territory aliases', () => {
    expect(territoryAliases, 'to have properties', ['AN', '062', 'BLZ']);
  });
  it('aliases are arrays of replacement rules', () => {
    expect(territoryAliases.BU, 'to have properties', [
      'replacement',
      'reason',
    ]);
    expect(territoryAliases.BU.replacement, 'to equal', 'MM');
    expect(territoryAliases.AN.replacement.split(' '), 'to have length', 3);
  });
});

describe('extractSubdivisionAliases', () => {
  let subdivisionAliases;
  before(() => {
    subdivisionAliases = cldr.extractSubdivisionAliases();
  });

  it('contains territory aliases', () => {
    expect(subdivisionAliases, 'to have properties', ['fi01', 'cn11', 'lug']);
  });
  it('aliases are replacement rules', () => {
    expect(subdivisionAliases.fi01, 'to have properties', [
      'replacement',
      'reason',
    ]);
    expect(subdivisionAliases.fi01.replacement, 'to equal', 'AX');
    expect(subdivisionAliases.fi01.reason, 'to equal', 'overlong');
    expect(subdivisionAliases.cn11.reason, 'to equal', 'deprecated');
    expect(subdivisionAliases.lug.replacement.split(' '), 'to have length', 3);
  });
});
