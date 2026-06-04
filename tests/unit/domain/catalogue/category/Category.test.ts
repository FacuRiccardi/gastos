import { describe, it, expect } from 'vitest';
import { Category } from '../../../../../src/domain/catalogue/category/Category.js';
import { CategoryId } from '../../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../../src/domain/identity/household/HouseholdId.js';
import { DomainError } from '../../../../../src/domain/shared/DomainError.js';

const id = CategoryId.generate();
const householdId = HouseholdId.generate();
const groupId = GroupId.generate();

describe('Category', () => {
  it('constructs with a valid id, householdId, groupId, and name', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    expect(category).toBeDefined();
  });

  it('rejects an empty name on construction', () => {
    expect(() => new Category(id, householdId, groupId, '')).toThrow(DomainError);
  });

  it('rename() returns a new Category with the updated name', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    const renamed = category.rename('Entertainment');
    expect(renamed.name).toBe('Entertainment');
  });

  it('rename() with an empty string throws', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    expect(() => category.rename('')).toThrow(DomainError);
  });

  it('rename() leaves the original unchanged', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    category.rename('Entertainment');
    expect(category.name).toBe('Food');
  });

  it('moveTo() returns a new Category with the new GroupId', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    const newGroupId = GroupId.generate();
    const moved = category.moveTo(newGroupId);
    expect(moved.groupId).toBe(newGroupId);
  });

  it('moveTo() leaves the original unchanged', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    category.moveTo(GroupId.generate());
    expect(category.groupId).toBe(groupId);
  });

  it('softDelete() returns a new Category marked as deleted', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    const deleted = category.softDelete();
    expect(deleted.isDeleted).toBe(true);
  });

  it('softDelete() leaves the original unchanged', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    category.softDelete();
    expect(category.isDeleted).toBe(false);
  });

  it('isDeleted is false for a non-deleted Category', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    expect(category.isDeleted).toBe(false);
  });

  it('isDeleted is true after soft delete', () => {
    const category = new Category(id, householdId, groupId, 'Food');
    expect(category.softDelete().isDeleted).toBe(true);
  });

  it('rename() throws on a deleted category', () => {
    const deleted = new Category(id, householdId, groupId, 'Food').softDelete();
    expect(() => deleted.rename('New Name')).toThrow(DomainError);
  });

  it('moveTo() throws on a deleted category', () => {
    const deleted = new Category(id, householdId, groupId, 'Food').softDelete();
    expect(() => deleted.moveTo(GroupId.generate())).toThrow(DomainError);
  });

  it('softDelete() throws on an already deleted category', () => {
    const deleted = new Category(id, householdId, groupId, 'Food').softDelete();
    expect(() => deleted.softDelete()).toThrow(DomainError);
  });
});
