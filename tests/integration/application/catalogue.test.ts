import { describe, it, expect, beforeEach } from 'vitest';
import { clearTables } from '../helpers/testDb.js';
import { makeRepos } from '../helpers/repositories.js';
import { CreateGroup } from '../../../src/application/catalogue/CreateGroup.js';
import { RenameGroup } from '../../../src/application/catalogue/RenameGroup.js';
import { SoftDeleteGroup } from '../../../src/application/catalogue/SoftDeleteGroup.js';
import { ListGroups } from '../../../src/application/catalogue/ListGroups.js';
import { CreateCategory } from '../../../src/application/catalogue/CreateCategory.js';
import { RenameCategory } from '../../../src/application/catalogue/RenameCategory.js';
import { MoveCategory } from '../../../src/application/catalogue/MoveCategory.js';
import { SoftDeleteCategory } from '../../../src/application/catalogue/SoftDeleteCategory.js';
import { ListCategories } from '../../../src/application/catalogue/ListCategories.js';
import { HouseholdId } from '../../../src/domain/identity/household/HouseholdId.js';
import { GroupId } from '../../../src/domain/catalogue/group/GroupId.js';

describe('Catalogue use cases (integration)', () => {
  const householdId = HouseholdId.generate();
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(async () => {
    await clearTables();
    repos = makeRepos();
  });

  describe('CreateGroup', () => {
    it('persists a group retrievable by findActiveByHousehold', async () => {
      const { id } = await new CreateGroup(repos.groups).execute({ householdId, name: 'Fixed' });

      const groups = await repos.groups.findActiveByHousehold(householdId);
      expect(groups).toHaveLength(1);
      expect(groups[0]!.id).toBe(id);
      expect(groups[0]!.name).toBe('Fixed');
    });
  });

  describe('RenameGroup', () => {
    it('persists the renamed group name', async () => {
      const { id } = await new CreateGroup(repos.groups).execute({ householdId, name: 'Old' });

      await new RenameGroup(repos.groups).execute({ id, newName: 'New' });

      const found = await repos.groups.findById(id);
      expect(found!.name).toBe('New');
    });

    it('throws when group does not exist', async () => {
      await expect(
        new RenameGroup(repos.groups).execute({ id: GroupId.generate(), newName: 'X' }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Group not found' });
    });
  });

  describe('SoftDeleteGroup', () => {
    it('soft-deleted group disappears from findActiveByHousehold', async () => {
      const { id } = await new CreateGroup(repos.groups).execute({ householdId, name: 'Temp' });

      await new SoftDeleteGroup(repos.groups).execute({ id });

      const active = await repos.groups.findActiveByHousehold(householdId);
      expect(active).toHaveLength(0);
      const found = await repos.groups.findById(id);
      expect(found!.isDeleted).toBe(true);
    });
  });

  describe('ListGroups', () => {
    it('returns only active groups for the household', async () => {
      const otherHousehold = HouseholdId.generate();
      await new CreateGroup(repos.groups).execute({ householdId, name: 'Mine' });
      await new CreateGroup(repos.groups).execute({ householdId: otherHousehold, name: 'Theirs' });
      const { id: deletedId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'Deleted' });
      await new SoftDeleteGroup(repos.groups).execute({ id: deletedId });

      const { groups } = await new ListGroups(repos.groups).execute({ householdId });

      expect(groups).toHaveLength(1);
      expect(groups[0]!.name).toBe('Mine');
    });
  });

  describe('CreateCategory', () => {
    it('persists a category retrievable by findActiveByGroup', async () => {
      const { id: groupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'G' });

      const { id } = await new CreateCategory(repos.categories, repos.groups).execute({
        householdId,
        groupId,
        name: 'Food',
      });

      const cats = await repos.categories.findActiveByGroup(groupId);
      expect(cats).toHaveLength(1);
      expect(cats[0]!.id).toBe(id);
    });

    it('throws when the parent group does not exist', async () => {
      await expect(
        new CreateCategory(repos.categories, repos.groups).execute({
          householdId,
          groupId: GroupId.generate(),
          name: 'Food',
        }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Group not found' });
    });
  });

  describe('RenameCategory', () => {
    it('persists the renamed category name', async () => {
      const { id: groupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'G' });
      const { id } = await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'Old' });

      await new RenameCategory(repos.categories).execute({ id, newName: 'New' });

      const found = await repos.categories.findById(id);
      expect(found!.name).toBe('New');
    });
  });

  describe('MoveCategory', () => {
    it('persists the new groupId after moving', async () => {
      const { id: groupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'G1' });
      const { id: newGroupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'G2' });
      const { id } = await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'C' });

      await new MoveCategory(repos.categories, repos.groups).execute({ id, targetGroupId: newGroupId });

      const found = await repos.categories.findById(id);
      expect(found!.groupId).toBe(newGroupId);
    });
  });

  describe('SoftDeleteCategory', () => {
    it('soft-deleted category disappears from findActiveByGroup', async () => {
      const { id: groupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'G' });
      const { id } = await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'C' });

      await new SoftDeleteCategory(repos.categories).execute({ id });

      const active = await repos.categories.findActiveByGroup(groupId);
      expect(active).toHaveLength(0);
    });
  });

  describe('ListCategories', () => {
    it('returns only active categories for the group', async () => {
      const { id: groupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'G' });
      await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'Active' });
      const { id: deletedId } = await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'Deleted' });
      await new SoftDeleteCategory(repos.categories).execute({ id: deletedId });

      const { categories } = await new ListCategories(repos.categories).execute({ groupId });

      expect(categories).toHaveLength(1);
      expect(categories[0]!.name).toBe('Active');
    });
  });
});
