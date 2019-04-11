const expect = require('unexpected');
const cldr = require('../lib/cldr');

describe('extractSubdivisionContainmentGroups', () => {
  let subdivisionContainmentGroups;
  before(() => {
    subdivisionContainmentGroups = cldr.extractSubdivisionContainmentGroups();
  });

  it('contains the chain UG > ugn > ug334', () => {
    expect(subdivisionContainmentGroups, 'to have properties', ['UG', 'ugn']);
    expect(subdivisionContainmentGroups.UG.contains, 'to contain', 'ugn');
    expect(subdivisionContainmentGroups.ugn.contains, 'to contain', 'ug334');
    expect(subdivisionContainmentGroups.ugn.parent, 'to equal', 'UG');
  });
});
