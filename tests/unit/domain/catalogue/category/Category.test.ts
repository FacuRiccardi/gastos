import { describe, it, expect } from 'vitest';
import { Category } from '../../../../../src/domain/catalogue/category/Category.js';
import { CategoryId } from '../../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../../src/domain/identity/household/HouseholdId.js';

describe('Category', () => {
  const categoryId = CategoryId.generate();
  const groupId = GroupId.generate();
  const anotherGroupId = GroupId.generate();
  const householdId = HouseholdId.generate();

  describe('valid construction', () => {
    it('creates a Category with a name, GroupId, and HouseholdId', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      expect(category.id).toBe(categoryId);
      expect(category.name).toBe('Food');
      expect(category.groupId).toBe(groupId);
      expect(category.householdId).toBe(householdId);
    });

    it('is not deleted on construction', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      expect(category.isDeleted).toBe(false);
    });
  });

  describe('invariants', () => {
    it('requires a CategoryId', () => {
      expect(() => new Category(null as unknown as CategoryId, 'Food', groupId, householdId)).toThrow();
    });

    it('requires a non-empty name', () => {
      expect(() => new Category(categoryId, '', groupId, householdId)).toThrow();
    });

    it('requires a GroupId', () => {
      expect(() => new Category(categoryId, 'Food', null as unknown as GroupId, householdId)).toThrow();
    });

    it('requires a HouseholdId', () => {
      expect(() => new Category(categoryId, 'Food', groupId, null as unknown as HouseholdId)).toThrow();
    });
  });

  describe('rename', () => {
    it('renames the category and returns a new instance', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      const renamed = category.rename('Groceries');
      expect(renamed.name).toBe('Groceries');
      expect(renamed).not.toBe(category);
    });

    it('rejects an empty name on rename', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      expect(() => category.rename('')).toThrow();
    });
  });

  describe('moveToGroup', () => {
    it('reassigns the Category to a different Group', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      const moved = category.moveToGroup(anotherGroupId);
      expect(moved.groupId).toBe(anotherGroupId);
    });

    it('returns a new instance on move', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      const moved = category.moveToGroup(anotherGroupId);
      expect(moved).not.toBe(category);
    });

    it('original category groupId is unchanged after move', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      category.moveToGroup(anotherGroupId);
      expect(category.groupId).toBe(groupId);
    });
  });

  describe('softDelete', () => {
    it('marks the category as deleted', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      const deleted = category.softDelete();
      expect(deleted.isDeleted).toBe(true);
    });

    it('returns a new instance on soft delete', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      const deleted = category.softDelete();
      expect(deleted).not.toBe(category);
    });

    it('original category remains not deleted after softDelete', () => {
      const category = new Category(categoryId, 'Food', groupId, householdId);
      category.softDelete();
      expect(category.isDeleted).toBe(false);
    });
  });
});
