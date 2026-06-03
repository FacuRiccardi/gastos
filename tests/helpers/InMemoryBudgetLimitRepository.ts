import { BudgetLimit } from '../../src/domain/budget/BudgetLimit.js';
import { BudgetLimitId } from '../../src/domain/budget/BudgetLimitId.js';
import { HouseholdId } from '../../src/domain/identity/household/HouseholdId.js';
import { BudgetLimitRepository } from '../../src/domain/budget/BudgetLimitRepository.js';

export class InMemoryBudgetLimitRepository implements BudgetLimitRepository {
  private store = new Map<string, BudgetLimit>();

  async findById(id: BudgetLimitId): Promise<BudgetLimit | null> {
    return this.store.get(id) ?? null;
  }

  async findByHousehold(householdId: HouseholdId): Promise<BudgetLimit[]> {
    return [...this.store.values()].filter((l) => l.householdId === householdId);
  }

  async save(limit: BudgetLimit): Promise<void> {
    this.store.set(limit.id, limit);
  }

  async delete(id: BudgetLimitId): Promise<void> {
    this.store.delete(id);
  }
}
