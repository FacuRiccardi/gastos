import { describe, it, expect } from 'vitest';
import { Household } from '../../../../../src/domain/identity/household/Household.js';
import { HouseholdId } from '../../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../../src/domain/identity/user/UserId.js';

describe('Household', () => {
  const householdId = HouseholdId.generate();
  const userId1 = UserId.generate();
  const userId2 = UserId.generate();

  describe('valid construction', () => {
    it('creates a Household with at least one member', () => {
      const household = new Household(householdId, [userId1]);
      expect(household.id).toBe(householdId);
      expect(household.memberIds).toContain(userId1);
    });

    it('creates a Household with multiple members', () => {
      const household = new Household(householdId, [userId1, userId2]);
      expect(household.memberIds).toHaveLength(2);
    });
  });

  describe('invariants', () => {
    it('rejects construction with empty member list', () => {
      expect(() => new Household(householdId, [])).toThrow();
    });

    it('requires a HouseholdId', () => {
      expect(() => new Household(null as unknown as HouseholdId, [userId1])).toThrow();
    });
  });

  describe('addMember', () => {
    it('adds a new member to the Household', () => {
      const household = new Household(householdId, [userId1]);
      const updated = household.addMember(userId2);
      expect(updated.memberIds).toContain(userId2);
    });

    it('returns a new Household instance (immutable)', () => {
      const household = new Household(householdId, [userId1]);
      const updated = household.addMember(userId2);
      expect(updated).not.toBe(household);
    });

    it('original household is unchanged after addMember', () => {
      const household = new Household(householdId, [userId1]);
      household.addMember(userId2);
      expect(household.memberIds).toHaveLength(1);
    });
  });
});
