import { User } from '../../src/domain/identity/user/User.js';
import { UserId } from '../../src/domain/identity/user/UserId.js';
import { UserRepository } from '../../src/domain/identity/user/UserRepository.js';

export class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();

  async findById(id: UserId): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, user);
  }
}
