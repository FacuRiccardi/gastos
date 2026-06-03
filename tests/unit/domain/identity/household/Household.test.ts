import { describe, it, expect } from 'vitest';
import { Household } from '../../../../../src/domain/identity/household/Household.js';
import { HouseholdId } from '../../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../../src/domain/identity/user/UserId.js';

const id = HouseholdId.generate();
const memberId = UserId.generate();

describe('Household', () => {
  it('constructs with a valid id, name, and at least one member', () => {
    const household = new Household(id, 'Home', [memberId]);
    expect(household).toBeDefined();
  });

  it('rejects an empty name on construction', () => {
    expect(() => new Household(id, '', [memberId])).toThrow();
  });

  it('rename() returns a new Household with the updated name', () => {
    const household = new Household(id, 'Home', [memberId]);
    const renamed = household.rename('Casa');
    expect(renamed.name).toBe('Casa');
  });

  it('rename() with an empty string throws', () => {
    const household = new Household(id, 'Home', [memberId]);
    expect(() => household.rename('')).toThrow();
  });

  it('rename() leaves the original unchanged', () => {
    const household = new Household(id, 'Home', [memberId]);
    household.rename('Casa');
    expect(household.name).toBe('Home');
  });

  it('addMember() returns a new Household with the additional member', () => {
    const household = new Household(id, 'Home', [memberId]);
    const newMember = UserId.generate();
    const updated = household.addMember(newMember);
    expect(updated.members).toContain(newMember);
  });

  it('addMember() leaves the original unchanged', () => {
    const household = new Household(id, 'Home', [memberId]);
    const newMember = UserId.generate();
    household.addMember(newMember);
    expect(household.members).toHaveLength(1);
  });

  it('addMember() throws when the user is already a member', () => {
    const household = new Household(id, 'Home', [memberId]);
    expect(() => household.addMember(memberId)).toThrow();
  });
});
