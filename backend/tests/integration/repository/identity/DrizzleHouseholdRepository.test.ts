import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearTables } from '../../helpers/testDb.js';
import { DrizzleHouseholdRepository } from '../../../../src/infrastructure/identity/DrizzleHouseholdRepository.js';
import { Household } from '../../../../src/domain/identity/household/Household.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';

describe('DrizzleHouseholdRepository', () => {
  let repo: DrizzleHouseholdRepository;

  beforeEach(async () => {
    await clearTables();
    repo = new DrizzleHouseholdRepository(testDb);
  });

  it('returns null for an unknown HouseholdId', async () => {
    const found = await repo.findById(HouseholdId.generate());
    expect(found).toBeNull();
  });

  it('saves and retrieves a Household with all fields intact', async () => {
    const id = HouseholdId.generate();
    const memberId = UserId.generate();
    const household = new Household(id, 'Smith Family', [memberId]);

    await repo.save(household);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.name).toBe('Smith Family');
    expect(found!.members).toHaveLength(1);
    expect(found!.members[0]).toBe(memberId);
  });

  it('save() with existing id overwrites the previous state', async () => {
    const id = HouseholdId.generate();
    const memberId = UserId.generate();
    const original = new Household(id, 'Old Name', [memberId]);
    await repo.save(original);

    const renamed = original.rename('New Name');
    await repo.save(renamed);
    const found = await repo.findById(id);

    expect(found!.name).toBe('New Name');
  });

  it('saves a Household with multiple members and retrieves them all', async () => {
    const id = HouseholdId.generate();
    const member1 = UserId.generate();
    const member2 = UserId.generate();
    const member3 = UserId.generate();
    const household = new Household(id, 'Big Family', [member1, member2, member3]);

    await repo.save(household);
    const found = await repo.findById(id);

    expect(found!.members).toHaveLength(3);
    expect(found!.members).toContain(member1);
    expect(found!.members).toContain(member2);
    expect(found!.members).toContain(member3);
  });

  it('adding a member via save() persists the new member list', async () => {
    const id = HouseholdId.generate();
    const original = new Household(id, 'Growing Family', [UserId.generate()]);
    await repo.save(original);

    const newMember = UserId.generate();
    const updated = original.addMember(newMember);
    await repo.save(updated);
    const found = await repo.findById(id);

    expect(found!.members).toHaveLength(2);
    expect(found!.members).toContain(newMember);
  });
});
