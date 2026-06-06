import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearTables } from '../../helpers/testDb.js';
import { DrizzleUserRepository } from '../../../../src/infrastructure/identity/DrizzleUserRepository.js';
import { DrizzleHouseholdRepository } from '../../../../src/infrastructure/identity/DrizzleHouseholdRepository.js';
import { User } from '../../../../src/domain/identity/user/User.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';
import { Household } from '../../../../src/domain/identity/household/Household.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';

describe('DrizzleUserRepository', () => {
  let repo: DrizzleUserRepository;
  let householdRepo: DrizzleHouseholdRepository;

  beforeEach(async () => {
    await clearTables();
    repo = new DrizzleUserRepository(testDb);
    householdRepo = new DrizzleHouseholdRepository(testDb);
  });

  it('saves and retrieves a User with all fields intact (no household)', async () => {
    const id = UserId.generate();
    const user = new User(id, 'Alice');

    await repo.save(user);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.name).toBe('Alice');
    expect(found!.householdId).toBeUndefined();
  });

  it('returns null for an unknown UserId', async () => {
    const found = await repo.findById(UserId.generate());
    expect(found).toBeNull();
  });

  it('save() with existing id overwrites the previous state', async () => {
    const id = UserId.generate();
    const user = new User(id, 'Alice');
    await repo.save(user);

    const householdId = HouseholdId.generate();
    const household = new Household(householdId, 'Home', [id]);
    await householdRepo.save(household);

    const updated = user.joinHousehold(householdId);
    await repo.save(updated);
    const found = await repo.findById(id);

    expect(found!.householdId).toBe(householdId);
  });

  it('reconstructs User.householdId from household_members after joining a Household', async () => {
    const userId = UserId.generate();
    const user = new User(userId, 'Bob');
    await repo.save(user);

    const householdId = HouseholdId.generate();
    const household = new Household(householdId, 'Casa', [userId]);
    await householdRepo.save(household);

    const found = await repo.findById(userId);
    expect(found!.householdId).toBe(householdId);
  });

  it('reconstructs User with no householdId when the User has not joined any Household', async () => {
    const userId = UserId.generate();
    await repo.save(new User(userId, 'Unhoused'));

    const found = await repo.findById(userId);
    expect(found!.householdId).toBeUndefined();
  });
});
