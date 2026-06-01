import { describe, it, expect } from 'vitest';
import { Group } from '../../../../../src/domain/catalogue/group/Group.js';
import { GroupId } from '../../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../../src/domain/identity/household/HouseholdId.js';

const id = GroupId.generate();
const householdId = HouseholdId.generate();

describe('Group', () => {
  it('constructs with a valid id, householdId, and name', () => {
    const group = new Group(id, householdId, 'Fixed Expenses');
    expect(group).toBeDefined();
  });

  it('rejects an empty name on construction', () => {
    expect(() => new Group(id, householdId, '')).toThrow();
  });

  it('rename() returns a new Group with the updated name', () => {
    const group = new Group(id, householdId, 'Fixed Expenses');
    const renamed = group.rename('Variable Expenses');
    expect(renamed.name).toBe('Variable Expenses');
  });

  it('rename() with an empty string throws', () => {
    const group = new Group(id, householdId, 'Fixed Expenses');
    expect(() => group.rename('')).toThrow();
  });

  it('rename() leaves the original unchanged', () => {
    const group = new Group(id, householdId, 'Fixed Expenses');
    group.rename('Variable Expenses');
    expect(group.name).toBe('Fixed Expenses');
  });

  it('softDelete() returns a new Group marked as deleted', () => {
    const group = new Group(id, householdId, 'Fixed Expenses');
    const deleted = group.softDelete();
    expect(deleted.isDeleted).toBe(true);
  });

  it('softDelete() leaves the original unchanged', () => {
    const group = new Group(id, householdId, 'Fixed Expenses');
    group.softDelete();
    expect(group.isDeleted).toBe(false);
  });

  it('isDeleted is false for a non-deleted Group', () => {
    const group = new Group(id, householdId, 'Fixed Expenses');
    expect(group.isDeleted).toBe(false);
  });

  it('isDeleted is true after soft delete', () => {
    const group = new Group(id, householdId, 'Fixed Expenses');
    expect(group.softDelete().isDeleted).toBe(true);
  });
});
