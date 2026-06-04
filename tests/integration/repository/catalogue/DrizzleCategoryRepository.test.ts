import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearTables } from '../../helpers/testDb.js';
import { DrizzleCategoryRepository } from '../../../../src/infrastructure/catalogue/DrizzleCategoryRepository.js';
import { Category } from '../../../../src/domain/catalogue/category/Category.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';

describe('DrizzleCategoryRepository', () => {
  let repo: DrizzleCategoryRepository;
  const householdId = HouseholdId.generate();
  const groupId = GroupId.generate();
  const otherGroupId = GroupId.generate();

  beforeEach(async () => {
    await clearTables();
    repo = new DrizzleCategoryRepository(testDb);
  });

  it('saves and retrieves an active Category with all fields intact', async () => {
    const id = CategoryId.generate();
    const category = new Category(id, householdId, groupId, 'Food');

    await repo.save(category);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.householdId).toBe(householdId);
    expect(found!.groupId).toBe(groupId);
    expect(found!.name).toBe('Food');
    expect(found!.deletedAt).toBeUndefined();
  });

  it('returns null for an unknown CategoryId', async () => {
    const found = await repo.findById(CategoryId.generate());
    expect(found).toBeNull();
  });

  it('save() with existing id overwrites the previous state (rename and move)', async () => {
    const id = CategoryId.generate();
    const category = new Category(id, householdId, groupId, 'Old Name');
    await repo.save(category);

    await repo.save(category.rename('New Name').moveTo(otherGroupId));
    const found = await repo.findById(id);

    expect(found!.name).toBe('New Name');
    expect(found!.groupId).toBe(otherGroupId);
  });

  it('findActiveByGroup() excludes soft-deleted Categories', async () => {
    const activeId = CategoryId.generate();
    const deletedId = CategoryId.generate();
    await repo.save(new Category(activeId, householdId, groupId, 'Active'));
    await repo.save(new Category(deletedId, householdId, groupId, 'Deleted').softDelete());

    const results = await repo.findActiveByGroup(groupId);

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(activeId);
  });

  it('findActiveByGroup() returns only Categories belonging to the given Group', async () => {
    await repo.save(new Category(CategoryId.generate(), householdId, groupId, 'Mine'));
    await repo.save(new Category(CategoryId.generate(), householdId, otherGroupId, 'Theirs'));

    const results = await repo.findActiveByGroup(groupId);

    expect(results).toHaveLength(1);
    expect(results[0]!.groupId).toBe(groupId);
  });

  it('findById() resolves a soft-deleted Category', async () => {
    const id = CategoryId.generate();
    await repo.save(new Category(id, householdId, groupId, 'Gone').softDelete());

    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.isDeleted).toBe(true);
  });

  it('findAllByGroup() returns both active and soft-deleted Categories for the Group', async () => {
    const activeId = CategoryId.generate();
    const deletedId = CategoryId.generate();
    await repo.save(new Category(activeId, householdId, groupId, 'Active'));
    await repo.save(new Category(deletedId, householdId, groupId, 'Deleted').softDelete());

    const results = await repo.findAllByGroup(groupId);

    expect(results).toHaveLength(2);
  });

  it('save() persists a soft-deleted Category (deleted_at is stored)', async () => {
    const id = CategoryId.generate();
    const category = new Category(id, householdId, groupId, 'Food');
    await repo.save(category);

    await repo.save(category.softDelete());
    const found = await repo.findById(id);

    expect(found!.isDeleted).toBe(true);
    expect(found!.deletedAt).toBeInstanceOf(Date);
  });
});
