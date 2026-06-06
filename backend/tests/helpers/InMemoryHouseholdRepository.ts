import { Household } from '../../src/domain/identity/household/Household.js';
import { HouseholdId } from '../../src/domain/identity/household/HouseholdId.js';
import { HouseholdRepository } from '../../src/domain/identity/household/HouseholdRepository.js';

export class InMemoryHouseholdRepository implements HouseholdRepository {
  private store = new Map<string, Household>();

  async findById(id: HouseholdId): Promise<Household | null> {
    return this.store.get(id) ?? null;
  }

  async save(household: Household): Promise<void> {
    this.store.set(household.id, household);
  }
}
