import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { HouseholdRepository } from '../../domain/identity/household/HouseholdRepository.js';
import { UserId } from '../../domain/identity/user/UserId.js';
import { UserRepository } from '../../domain/identity/user/UserRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface JoinHouseholdInput {
  userId: UserId;
  householdId: HouseholdId;
}

export class JoinHousehold {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(input: JoinHouseholdInput): Promise<void> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new ApplicationError('User not found');

    const household = await this.households.findById(input.householdId);
    if (!household) throw new ApplicationError('Household not found');

    const updatedHousehold = household.addMember(input.userId);
    const updatedUser = user.joinHousehold(input.householdId);

    await this.households.save(updatedHousehold);
    await this.users.save(updatedUser);
  }
}
