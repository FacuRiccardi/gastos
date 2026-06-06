import { describe, it, expect, beforeEach } from 'vitest';
import { CreateUser } from '../../../../src/application/identity/CreateUser.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';

describe('CreateUser', () => {
  let users: InMemoryUserRepository;
  let useCase: CreateUser;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    useCase = new CreateUser(users);
  });

  it('persists a new user and returns its id', async () => {
    const result = await useCase.execute({ name: 'Alice' });

    const saved = await users.findById(result.id);
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe('Alice');
  });
});
