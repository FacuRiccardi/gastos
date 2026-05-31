import { describe, it, expect } from 'vitest';
import { Group } from '../../../../../src/domain/catalogue/group/Group.js';
import { GroupId } from '../../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../../src/domain/identity/household/HouseholdId.js';

describe('Group', () => {
  const groupId = GroupId.generate();
  const householdId = HouseholdId.generate();

  describe('valid construction', () => {
    it('creates a Group with a name and HouseholdId', () => {
      const group = new Group(groupId, 'Fixed Expenses', householdId);
      expect(group.id).toBe(groupId);
      expect(group.name).toBe('Fixed Expenses');
      expect(group.householdId).toBe(householdId);
    });

    it('is not deleted on construction', () => {
      const group = new Group(groupId, 'Fixed Expenses', householdId);
      expect(group.isDeleted).toBe(false);
    });
  });

  describe('invariants', () => {
    it('requires a GroupId', () => {
      expect(() => new Group(null as unknown as GroupId, 'Fixed Expenses', householdId)).toThrow();
    });

    it('requires a non-empty name', () => {
      expect(() => new Group(groupId, '', householdId)).toThrow();
    });

    it('requires a HouseholdId', () => {
      expect(() => new Group(groupId, 'Fixed Expenses', null as unknown as HouseholdId)).toThrow();
    });
  });

  describe('rename', () => {
    it('renames the group and returns a new instance', () => {
      const group = new Group(groupId, 'Fixed Expenses', householdId);
      const renamed = group.rename('Non-Primary Expenses');
      expect(renamed.name).toBe('Non-Primary Expenses');
      expect(renamed).not.toBe(group);
    });

    it('rejects an empty name on rename', () => {
      const group = new Group(groupId, 'Fixed Expenses', householdId);
      expect(() => group.rename('')).toThrow();
    });
  });

  describe('softDelete', () => {
    it('marks the group as deleted', () => {
      const group = new Group(groupId, 'Fixed Expenses', householdId);
      const deleted = group.softDelete();
      expect(deleted.isDeleted).toBe(true);
    });

    it('returns a new instance on soft delete', () => {
      const group = new Group(groupId, 'Fixed Expenses', householdId);
      const deleted = group.softDelete();
      expect(deleted).not.toBe(group);
    });

    it('original group remains not deleted after softDelete', () => {
      const group = new Group(groupId, 'Fixed Expenses', householdId);
      group.softDelete();
      expect(group.isDeleted).toBe(false);
    });
  });
});
