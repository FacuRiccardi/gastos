import { BudgetLimit } from '../../domain/budget/BudgetLimit.js';
import { BudgetLimitRepository } from '../../domain/budget/BudgetLimitRepository.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';

export interface ListBudgetLimitsInput {
  householdId: HouseholdId;
}

export type ListBudgetLimitsOutput = { limits: BudgetLimit[] };

export class ListBudgetLimits {
  constructor(private readonly limits: BudgetLimitRepository) {}

  async execute(input: ListBudgetLimitsInput): Promise<ListBudgetLimitsOutput> {
    const limits = await this.limits.findByHousehold(input.householdId);
    return { limits };
  }
}
