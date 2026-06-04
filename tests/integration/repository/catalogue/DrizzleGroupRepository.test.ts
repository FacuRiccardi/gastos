import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearTables } from '../../helpers/testDb.js';
import { DrizzleGroupRepository } from '../../../../src/infrastructure/catalogue/DrizzleGroupRepository.js';
import { Group } from '../../../../src/domain/catalogue/group/Group.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';

describe('DrizzleGroupRepository', () => {
  let repo: DrizzleGroupRepository;
  const householdId = HouseholdId.generate();

  beforeEach(async () => {
    await clearTables();
    repo = new DrizzleGroupRepository(testDb);
  });

  it('saves and retrieves an active Group with all fields intact', async () => {
    const id = GroupId.generate();
    const group = new Group(id, householdId, 'Fixed Expenses');

    await repo.save(group);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.householdId).toBe(householdId);
    expect(found!.name).toBe('Fixed Expenses');
    expect(found!.deletedAt).toBeUndefined();
  });

  it('returns null for an unknown GroupId', async () => {
    const found = await repo.findById(GroupId.generate());
    expect(found).toBeNull();
  });

  it('save() with existing id overwrites the previous state', async () => {
    const id = GroupId.generate();
    const group = new Group(id, householdId, 'Old Name');
    await repo.save(group);

    await repo.save(group.rename('New Name'));
    const found = await repo.findById(id);

    expect(found!.name).toBe('New Name');
  });

  it('findActiveByHousehold() excludes soft-deleted Groups', async () => {
    const activeId = GroupId.generate();
    const deletedId = GroupId.generate();
    await repo.save(new Group(activeId, householdId, 'Active'));
    await repo.save(new Group(deletedId, householdId, 'Deleted').softDelete());

    const results = await repo.findActiveByHousehold(householdId);

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(activeId);
  });

  it('findActiveByHousehold() returns only Groups belonging to the given Household', async () => {
    const otherId = HouseholdId.generate();
    await repo.save(new Group(GroupId.generate(), householdId, 'Mine'));
    await repo.save(new Group(GroupId.generate(), otherId, 'Theirs'));

    const results = await repo.findActiveByHousehold(householdId);

    expect(results).toHaveLength(1);
    expect(results[0]!.householdId).toBe(householdId);
  });

  it('findById() resolves a soft-deleted Group', async () => {
    const id = GroupId.generate();
    const deleted = new Group(id, householdId, 'Gone').softDelete();
    await repo.save(deleted);

    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.isDeleted).toBe(true);
  });

  it('save() persists a soft-deleted Group (deleted_at is stored)', async () => {
    const id = GroupId.generate();
    const group = new Group(id, householdId, 'Will Be Deleted');
    await repo.save(group);

    const deleted = group.softDelete();
    await repo.save(deleted);
    const found = await repo.findById(id);

    expect(found!.isDeleted).toBe(true);
    expect(found!.deletedAt).toBeInstanceOf(Date);
  });
});
