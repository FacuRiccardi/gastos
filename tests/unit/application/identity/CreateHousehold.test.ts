import { describe, it, expect, beforeEach } from 'vitest';
import { CreateHousehold } from '../../../../src/application/identity/CreateHousehold.js';
import { InMemoryHouseholdRepository } from '../../../helpers/InMemoryHouseholdRepository.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';
import { User } from '../../../../src/domain/identity/user/User.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';

describe('CreateHousehold', () => {
  let households: InMemoryHouseholdRepository;
  let users: InMemoryUserRepository;
  let useCase: CreateHousehold;

  beforeEach(() => {
    households = new InMemoryHouseholdRepository();
    users = new InMemoryUserRepository();
    useCase = new CreateHousehold(households, users);
  });

  it('persists a new household with the creator as its first member and returns its id', async () => {
    const userId = UserId.generate();
    await users.save(new User(userId, 'Alice'));

    const result = await useCase.execute({ name: 'Casa', creatorId: userId });

    const saved = await households.findById(result.id);
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe('Casa');
    expect(saved!.members).toContain(userId);
  });

  it('throws when the creator user does not exist', async () => {
    const userId = UserId.generate();

    await expect(
      useCase.execute({ name: 'Casa', creatorId: userId }),
    ).rejects.toMatchObject({ type: 'Application', message: 'User not found' });
  });
});
