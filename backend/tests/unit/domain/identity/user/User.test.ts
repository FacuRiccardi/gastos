import { describe, it, expect } from 'vitest';
import { User } from '../../../../../src/domain/identity/user/User.js';
import { UserId } from '../../../../../src/domain/identity/user/UserId.js';
import { HouseholdId } from '../../../../../src/domain/identity/household/HouseholdId.js';
import { DomainError } from '../../../../../src/domain/shared/DomainError.js';

const userId = UserId.generate();
const householdId = HouseholdId.generate();

describe('User', () => {
  it('rejects an empty name on construction', () => {
    expect(() => new User(userId, '')).toThrow(DomainError);
  });

  it('rejects a whitespace-only name on construction', () => {
    expect(() => new User(userId, '   ')).toThrow(DomainError);
  });

  it('constructs with a valid UserId and name (no Household)', () => {
    const user = new User(userId, 'Alice');
    expect(user).toBeDefined();
  });

  it('a newly created User has no Household', () => {
    const user = new User(userId, 'Alice');
    expect(user.householdId).toBeUndefined();
  });

  it('joinHousehold() returns a new User with the HouseholdId set', () => {
    const user = new User(userId, 'Alice');
    const joined = user.joinHousehold(householdId);
    expect(joined.householdId).toBe(householdId);
  });

  it('joinHousehold() leaves the original unchanged', () => {
    const user = new User(userId, 'Alice');
    user.joinHousehold(householdId);
    expect(user.householdId).toBeUndefined();
  });

  it('joinHousehold() throws when the User already belongs to a Household', () => {
    const user = new User(userId, 'Alice', householdId);
    expect(() => user.joinHousehold(HouseholdId.generate())).toThrow(DomainError);
  });
});
