import { User } from './User.js';
import { UserId } from './UserId.js';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  save(user: User): Promise<void>;
}
