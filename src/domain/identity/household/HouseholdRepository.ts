import { Household } from './Household.js';
import { HouseholdId } from './HouseholdId.js';

export interface HouseholdRepository {
  findById(id: HouseholdId): Promise<Household | null>;
  save(household: Household): Promise<void>;
}
