import { BudgetLimit } from './BudgetLimit.js';
import { BudgetLimitId } from './BudgetLimitId.js';
import { HouseholdId } from '../identity/household/HouseholdId.js';

export interface BudgetLimitRepository {
  findById(id: BudgetLimitId): Promise<BudgetLimit | null>;
  findByHousehold(householdId: HouseholdId): Promise<BudgetLimit[]>;
  save(limit: BudgetLimit): Promise<void>;
  delete(id: BudgetLimitId): Promise<void>;
}
