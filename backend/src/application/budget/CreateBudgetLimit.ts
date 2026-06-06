import { BudgetLimitId } from '../../domain/budget/BudgetLimitId.js';
import { BudgetLimit } from '../../domain/budget/BudgetLimit.js';
import { BudgetPeriod } from '../../domain/budget/BudgetPeriod.js';
import { BudgetLimitRepository } from '../../domain/budget/BudgetLimitRepository.js';
import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { Money } from '../../domain/shared/Money.js';
import { ApplicationError } from '../ApplicationError.js';

export interface CreateBudgetLimitInput {
  householdId: HouseholdId;
  money: Money;
  period: BudgetPeriod;
  categoryId?: CategoryId;
  groupId?: GroupId;
}

export type CreateBudgetLimitOutput = { id: BudgetLimitId };

export class CreateBudgetLimit {
  constructor(private readonly limits: BudgetLimitRepository) {}

  async execute(input: CreateBudgetLimitInput): Promise<CreateBudgetLimitOutput> {
    if (!input.categoryId && !input.groupId) {
      throw new ApplicationError('Either categoryId or groupId must be provided');
    }
    const id = BudgetLimitId.generate();
    const limit = input.categoryId !== undefined
      ? BudgetLimit.forCategory(id, input.householdId, input.money, input.period, input.categoryId)
      : BudgetLimit.forGroup(id, input.householdId, input.money, input.period, input.groupId!);
    await this.limits.save(limit);
    return { id };
  }
}
