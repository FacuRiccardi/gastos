import { describe, it, expect } from 'vitest';
import { User } from '../../../../../src/domain/identity/user/User.js';
import { UserId } from '../../../../../src/domain/identity/user/UserId.js';
import { HouseholdId } from '../../../../../src/domain/identity/household/HouseholdId.js';

describe('User', () => {
  const userId = UserId.generate();
  const householdId = HouseholdId.generate();
  const anotherHouseholdId = HouseholdId.generate();

  describe('valid construction', () => {
    it('creates a User without a Household', () => {
      const user = new User(userId, 'Alice');
      expect(user.id).toBe(userId);
      expect(user.name).toBe('Alice');
      expect(user.householdId).toBeNull();
    });

    it('creates a User with a Household', () => {
      const user = new User(userId, 'Alice', householdId);
      expect(user.householdId).toBe(householdId);
    });
  });

  describe('invariants', () => {
    it('requires a UserId', () => {
      expect(() => new User(null as unknown as UserId, 'Alice')).toThrow();
    });

    it('requires a non-empty name', () => {
      expect(() => new User(userId, '')).toThrow();
    });
  });

  describe('joinHousehold', () => {
    it('joins a Household when the User has none', () => {
      const user = new User(userId, 'Alice');
      const updated = user.joinHousehold(householdId);
      expect(updated.householdId).toBe(householdId);
    });

    it('returns a new User instance (immutable)', () => {
      const user = new User(userId, 'Alice');
      const updated = user.joinHousehold(householdId);
      expect(updated).not.toBe(user);
    });

    it('rejects joining a Household when already in one', () => {
      const user = new User(userId, 'Alice', householdId);
      expect(() => user.joinHousehold(anotherHouseholdId)).toThrow();
    });

    it('a User can exist without a Household and cannot perform actions without one', () => {
      const user = new User(userId, 'Alice');
      expect(user.belongsToHousehold()).toBe(false);
    });

    it('a User in a Household belongs to a Household', () => {
      const user = new User(userId, 'Alice', householdId);
      expect(user.belongsToHousehold()).toBe(true);
    });
  });
});
