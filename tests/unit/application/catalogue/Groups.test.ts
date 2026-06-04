import { describe, it, expect, beforeEach } from 'vitest';
import { CreateGroup } from '../../../../src/application/catalogue/CreateGroup.js';
import { RenameGroup } from '../../../../src/application/catalogue/RenameGroup.js';
import { SoftDeleteGroup } from '../../../../src/application/catalogue/SoftDeleteGroup.js';
import { ListGroups } from '../../../../src/application/catalogue/ListGroups.js';
import { InMemoryGroupRepository } from '../../../helpers/InMemoryGroupRepository.js';
import { Group } from '../../../../src/domain/catalogue/group/Group.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';

describe('Catalogue / Groups', () => {
  let groups: InMemoryGroupRepository;
  const householdId = HouseholdId.generate();

  beforeEach(() => {
    groups = new InMemoryGroupRepository();
  });

  describe('CreateGroup', () => {
    it('persists a new group and returns its id', async () => {
      const useCase = new CreateGroup(groups);

      const result = await useCase.execute({ householdId, name: 'Fixed Expenses' });

      const saved = await groups.findById(result.id);
      expect(saved).not.toBeNull();
      expect(saved!.name).toBe('Fixed Expenses');
      expect(saved!.householdId).toBe(householdId);
    });
  });

  describe('RenameGroup', () => {
    it('renames the group and persists the updated aggregate', async () => {
      const useCase = new RenameGroup(groups);
      const id = GroupId.generate();
      await groups.save(new Group(id, householdId, 'Old Name'));

      await useCase.execute({ id, newName: 'New Name' });

      const saved = await groups.findById(id);
      expect(saved!.name).toBe('New Name');
    });

    it('throws when the group does not exist', async () => {
      const useCase = new RenameGroup(groups);

      await expect(
        useCase.execute({ id: GroupId.generate(), newName: 'X' }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Group not found' });
    });
  });

  describe('SoftDeleteGroup', () => {
    it('marks the group as deleted and persists the updated aggregate', async () => {
      const useCase = new SoftDeleteGroup(groups);
      const id = GroupId.generate();
      await groups.save(new Group(id, householdId, 'Food'));

      await useCase.execute({ id });

      const saved = await groups.findById(id);
      expect(saved!.isDeleted).toBe(true);
    });

    it('throws when the group does not exist', async () => {
      const useCase = new SoftDeleteGroup(groups);

      await expect(useCase.execute({ id: GroupId.generate() })).rejects.toMatchObject({ type: 'Application', message: 'Group not found' });
    });
  });

  describe('ListGroups', () => {
    it('returns only active groups for the household', async () => {
      const useCase = new ListGroups(groups);
      const activeId = GroupId.generate();
      const deletedId = GroupId.generate();
      await groups.save(new Group(activeId, householdId, 'Active'));
      await groups.save(new Group(deletedId, householdId, 'Deleted', new Date()));

      const result = await useCase.execute({ householdId });

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].id).toBe(activeId);
    });
  });
});
