const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractTerritoryContainmentGroups', () => {
  let territoryContainmentGroups;
  before(() => {
    territoryContainmentGroups = cldr.extractTerritoryContainmentGroups();
  });

  it('contains group 029, which is a descendant of 019, which is a descendant of 001', () => {
    expect(territoryContainmentGroups, 'to have properties', [
      '029',
      '019',
      '001',
    ]);
  });

  it('only contains groups that are descendants of group 001', () => {
    expect(
      Object.keys(territoryContainmentGroups),
      'to have items satisfying',
      expect.it((index) => {
        const item = territoryContainmentGroups[index];
        expect(
          index === '001' || ('parent' in item && Boolean(item.parent)),
          'to be',
          true
        );
      })
    );
  });
});
