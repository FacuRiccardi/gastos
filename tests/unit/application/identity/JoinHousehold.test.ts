import { describe, it, expect, beforeEach } from 'vitest';
import { JoinHousehold } from '../../../../src/application/identity/JoinHousehold.js';
import { InMemoryHouseholdRepository } from '../../../helpers/InMemoryHouseholdRepository.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';
import { Household } from '../../../../src/domain/identity/household/Household.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { User } from '../../../../src/domain/identity/user/User.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';

describe('JoinHousehold', () => {
  let households: InMemoryHouseholdRepository;
  let users: InMemoryUserRepository;
  let useCase: JoinHousehold;

  beforeEach(() => {
    households = new InMemoryHouseholdRepository();
    users = new InMemoryUserRepository();
    useCase = new JoinHousehold(households, users);
  });

  it('adds the user to the household and persists both aggregates', async () => {
    const ownerId = UserId.generate();
    const householdId = HouseholdId.generate();
    await users.save(new User(ownerId, 'Owner'));
    await households.save(new Household(householdId, 'Casa', [ownerId]));

    const newUserId = UserId.generate();
    await users.save(new User(newUserId, 'Bob'));

    await useCase.execute({ userId: newUserId, householdId });

    const savedHousehold = await households.findById(householdId);
    expect(savedHousehold!.members).toContain(newUserId);

    const savedUser = await users.findById(newUserId);
    expect(savedUser!.householdId).toBe(householdId);
  });

  it('throws when the user does not exist', async () => {
    const householdId = HouseholdId.generate();
    const ownerId = UserId.generate();
    await users.save(new User(ownerId, 'Owner'));
    await households.save(new Household(householdId, 'Casa', [ownerId]));

    await expect(
      useCase.execute({ userId: UserId.generate(), householdId }),
    ).rejects.toThrow();
  });

  it('throws when the household does not exist', async () => {
    const userId = UserId.generate();
    await users.save(new User(userId, 'Bob'));

    await expect(
      useCase.execute({ userId, householdId: HouseholdId.generate() }),
    ).rejects.toThrow();
  });
});
