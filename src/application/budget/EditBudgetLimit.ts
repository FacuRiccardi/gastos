import { BudgetLimitId } from '../../domain/budget/BudgetLimitId.js';
import { BudgetPeriod } from '../../domain/budget/BudgetPeriod.js';
import { BudgetLimitRepository } from '../../domain/budget/BudgetLimitRepository.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { Money } from '../../domain/shared/Money.js';
import { ApplicationError } from '../ApplicationError.js';

export interface EditBudgetLimitInput {
  id: BudgetLimitId;
  money: Money;
  period: BudgetPeriod;
  householdId: HouseholdId;
}

export class EditBudgetLimit {
  constructor(private readonly limits: BudgetLimitRepository) {}

  async execute(input: EditBudgetLimitInput): Promise<void> {
    const limit = await this.limits.findById(input.id);
    if (!limit || limit.householdId !== input.householdId) {
      throw new ApplicationError('BudgetLimit not found');
    }

    await this.limits.save(limit.edit(input.money, input.period));
  }
}
