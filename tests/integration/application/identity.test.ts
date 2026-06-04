import { describe, it, expect, beforeEach } from 'vitest';
import { clearTables } from '../helpers/testDb.js';
import { makeRepos } from '../helpers/repositories.js';
import { CreateUser } from '../../../src/application/identity/CreateUser.js';
import { CreateHousehold } from '../../../src/application/identity/CreateHousehold.js';
import { JoinHousehold } from '../../../src/application/identity/JoinHousehold.js';

describe('Identity use cases (integration)', () => {
  beforeEach(async () => {
    await clearTables();
  });

  describe('CreateUser', () => {
    it('persists a new user retrievable by the returned id', async () => {
      const repos = makeRepos();
      const useCase = new CreateUser(repos.users);

      const { id } = await useCase.execute({ name: 'Alice' });
      const found = await repos.users.findById(id);

      expect(found).not.toBeNull();
      expect(found!.name).toBe('Alice');
      expect(found!.householdId).toBeUndefined();
    });
  });

  describe('CreateHousehold', () => {
    it('persists a household with the creator as its first member', async () => {
      const repos = makeRepos();
      const { id: userId } = await new CreateUser(repos.users).execute({ name: 'Bob' });

      const { id } = await new CreateHousehold(repos.households, repos.users).execute({
        name: 'Smith Family',
        creatorId: userId,
      });

      const found = await repos.households.findById(id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Smith Family');
      expect(found!.members).toContain(userId);
    });

    it('throws when the creator user does not exist', async () => {
      const repos = makeRepos();
      const { UserId } = await import('../../../src/domain/identity/user/UserId.js');

      await expect(
        new CreateHousehold(repos.households, repos.users).execute({
          name: 'Ghost House',
          creatorId: UserId.generate(),
        }),
      ).rejects.toMatchObject({ type: 'Application', message: 'User not found' });
    });
  });

  describe('JoinHousehold', () => {
    it('adds the user to the household members and sets their householdId', async () => {
      const repos = makeRepos();
      const { id: creatorId } = await new CreateUser(repos.users).execute({ name: 'Creator' });
      const { id: householdId } = await new CreateHousehold(repos.households, repos.users).execute({
        name: 'Casa',
        creatorId,
      });
      const { id: newMemberId } = await new CreateUser(repos.users).execute({ name: 'Joiner' });

      await new JoinHousehold(repos.households, repos.users).execute({
        userId: newMemberId,
        householdId,
      });

      const household = await repos.households.findById(householdId);
      const user = await repos.users.findById(newMemberId);
      expect(household!.members).toContain(newMemberId);
      expect(user!.householdId).toBe(householdId);
    });

    it('throws when the user does not exist', async () => {
      const repos = makeRepos();
      const { UserId } = await import('../../../src/domain/identity/user/UserId.js');
      const { HouseholdId } = await import('../../../src/domain/identity/household/HouseholdId.js');

      await expect(
        new JoinHousehold(repos.households, repos.users).execute({
          userId: UserId.generate(),
          householdId: HouseholdId.generate(),
        }),
      ).rejects.toMatchObject({ type: 'Application', message: 'User not found' });
    });
  });
});
