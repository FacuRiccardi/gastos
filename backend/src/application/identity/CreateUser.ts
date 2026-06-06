import { UserId } from '../../domain/identity/user/UserId.js';
import { User } from '../../domain/identity/user/User.js';
import { UserRepository } from '../../domain/identity/user/UserRepository.js';

export interface CreateUserInput {
  name: string;
}

export type CreateUserOutput = { id: UserId };

export class CreateUser {
  constructor(private readonly users: UserRepository) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    const id = UserId.generate();
    const user = new User(id, input.name);
    await this.users.save(user);
    return { id };
  }
}
