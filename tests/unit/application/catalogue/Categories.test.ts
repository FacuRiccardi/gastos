import { describe, it, expect, beforeEach } from 'vitest';
import { CreateCategory } from '../../../../src/application/catalogue/CreateCategory.js';
import { RenameCategory } from '../../../../src/application/catalogue/RenameCategory.js';
import { MoveCategory } from '../../../../src/application/catalogue/MoveCategory.js';
import { SoftDeleteCategory } from '../../../../src/application/catalogue/SoftDeleteCategory.js';
import { ListCategories } from '../../../../src/application/catalogue/ListCategories.js';
import { InMemoryCategoryRepository } from '../../../helpers/InMemoryCategoryRepository.js';
import { InMemoryGroupRepository } from '../../../helpers/InMemoryGroupRepository.js';
import { Category } from '../../../../src/domain/catalogue/category/Category.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { Group } from '../../../../src/domain/catalogue/group/Group.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';

describe('Catalogue / Categories', () => {
  let categories: InMemoryCategoryRepository;
  let groups: InMemoryGroupRepository;
  const householdId = HouseholdId.generate();
  let groupId: GroupId;

  beforeEach(() => {
    categories = new InMemoryCategoryRepository();
    groups = new InMemoryGroupRepository();
    groupId = GroupId.generate();
  });

  describe('CreateCategory', () => {
    it('persists a new category under the given group and returns its id', async () => {
      await groups.save(new Group(groupId, householdId, 'Fixed'));
      const useCase = new CreateCategory(categories, groups);

      const result = await useCase.execute({ householdId, groupId, name: 'Rent' });

      const saved = await categories.findById(result.id);
      expect(saved).not.toBeNull();
      expect(saved!.name).toBe('Rent');
      expect(saved!.groupId).toBe(groupId);
    });

    it('throws when the group does not exist', async () => {
      const useCase = new CreateCategory(categories, groups);

      await expect(
        useCase.execute({ householdId, groupId: GroupId.generate(), name: 'Rent' }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Group not found' });
    });

    it('throws when the group belongs to a different household', async () => {
      const otherHouseholdId = HouseholdId.generate();
      await groups.save(new Group(groupId, otherHouseholdId, 'Fixed'));
      const useCase = new CreateCategory(categories, groups);

      await expect(
        useCase.execute({ householdId, groupId, name: 'Rent' }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Group not found' });
    });
  });

  describe('RenameCategory', () => {
    it('renames the category and persists the updated aggregate', async () => {
      const useCase = new RenameCategory(categories);
      const id = CategoryId.generate();
      await categories.save(new Category(id, householdId, groupId, 'Old'));

      await useCase.execute({ id, newName: 'New', householdId });

      const saved = await categories.findById(id);
      expect(saved!.name).toBe('New');
    });

    it('throws when the category does not exist', async () => {
      const useCase = new RenameCategory(categories);

      await expect(
        useCase.execute({ id: CategoryId.generate(), newName: 'X', householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Category not found' });
    });

    it('throws when the category belongs to a different household', async () => {
      const useCase = new RenameCategory(categories);
      const id = CategoryId.generate();
      const otherHouseholdId = HouseholdId.generate();
      await categories.save(new Category(id, otherHouseholdId, groupId, 'Some Category'));

      await expect(
        useCase.execute({ id, newName: 'New', householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Category not found' });
    });
  });

  describe('MoveCategory', () => {
    it('moves the category to the target group and persists the updated aggregate', async () => {
      const useCase = new MoveCategory(categories, groups);
      const id = CategoryId.generate();
      const targetGroupId = GroupId.generate();
      await categories.save(new Category(id, householdId, groupId, 'Food'));
      await groups.save(new Group(targetGroupId, householdId, 'Variable'));

      await useCase.execute({ id, targetGroupId, householdId });

      const saved = await categories.findById(id);
      expect(saved!.groupId).toBe(targetGroupId);
    });

    it('throws when the category does not exist', async () => {
      const useCase = new MoveCategory(categories, groups);
      const targetGroupId = GroupId.generate();
      await groups.save(new Group(targetGroupId, householdId, 'Variable'));

      await expect(
        useCase.execute({ id: CategoryId.generate(), targetGroupId, householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Category not found' });
    });

    it('throws when the target group does not exist', async () => {
      const useCase = new MoveCategory(categories, groups);
      const id = CategoryId.generate();
      await categories.save(new Category(id, householdId, groupId, 'Food'));

      await expect(
        useCase.execute({ id, targetGroupId: GroupId.generate(), householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Target group not found' });
    });

    it('throws when the target group belongs to a different household', async () => {
      const useCase = new MoveCategory(categories, groups);
      const id = CategoryId.generate();
      const otherHouseholdId = HouseholdId.generate();
      const targetGroupId = GroupId.generate();
      await categories.save(new Category(id, householdId, groupId, 'Food'));
      await groups.save(new Group(targetGroupId, otherHouseholdId, 'Other Household Group'));

      await expect(
        useCase.execute({ id, targetGroupId, householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Target group not found' });
    });

    it('throws when the target group is soft-deleted', async () => {
      const useCase = new MoveCategory(categories, groups);
      const id = CategoryId.generate();
      const targetGroupId = GroupId.generate();
      await categories.save(new Category(id, householdId, groupId, 'Food'));
      await groups.save(new Group(targetGroupId, householdId, 'Deleted Group', new Date()));

      await expect(
        useCase.execute({ id, targetGroupId, householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Target group is deleted' });
    });

    it('throws when the category belongs to a different household', async () => {
      const useCase = new MoveCategory(categories, groups);
      const id = CategoryId.generate();
      const otherHouseholdId = HouseholdId.generate();
      const targetGroupId = GroupId.generate();
      await categories.save(new Category(id, otherHouseholdId, groupId, 'Food'));
      await groups.save(new Group(targetGroupId, householdId, 'Variable'));

      await expect(
        useCase.execute({ id, targetGroupId, householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Category not found' });
    });
  });

  describe('SoftDeleteCategory', () => {
    it('marks the category as deleted and persists the updated aggregate', async () => {
      const useCase = new SoftDeleteCategory(categories);
      const id = CategoryId.generate();
      await categories.save(new Category(id, householdId, groupId, 'Food'));

      await useCase.execute({ id, householdId });

      const saved = await categories.findById(id);
      expect(saved!.isDeleted).toBe(true);
    });

    it('throws when the category does not exist', async () => {
      const useCase = new SoftDeleteCategory(categories);

      await expect(
        useCase.execute({ id: CategoryId.generate(), householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Category not found' });
    });

    it('throws when the category belongs to a different household', async () => {
      const useCase = new SoftDeleteCategory(categories);
      const id = CategoryId.generate();
      const otherHouseholdId = HouseholdId.generate();
      await categories.save(new Category(id, otherHouseholdId, groupId, 'Some Category'));

      await expect(
        useCase.execute({ id, householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Category not found' });
    });
  });

  describe('ListCategories', () => {
    it('returns only active categories for the given group', async () => {
      const useCase = new ListCategories(categories);
      const activeId = CategoryId.generate();
      const deletedId = CategoryId.generate();
      await categories.save(new Category(activeId, householdId, groupId, 'Active'));
      await categories.save(new Category(deletedId, householdId, groupId, 'Deleted', new Date()));

      const result = await useCase.execute({ groupId });

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].id).toBe(activeId);
    });
  });
});
