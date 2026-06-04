import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { Household } from '../../domain/identity/household/Household.js';
import { HouseholdRepository } from '../../domain/identity/household/HouseholdRepository.js';
import { UserId } from '../../domain/identity/user/UserId.js';
import { UserRepository } from '../../domain/identity/user/UserRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface CreateHouseholdInput {
  name: string;
  creatorId: UserId;
}

export type CreateHouseholdOutput = { id: HouseholdId };

export class CreateHousehold {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(input: CreateHouseholdInput): Promise<CreateHouseholdOutput> {
    const creator = await this.users.findById(input.creatorId);
    if (!creator) throw new ApplicationError('User not found');

    const id = HouseholdId.generate();
    const household = new Household(id, input.name, [input.creatorId]);
    await this.households.save(household);
    return { id };
  }
}
