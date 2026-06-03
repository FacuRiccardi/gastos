import { BudgetLimitId } from './BudgetLimitId.js';
import { BudgetPeriod } from './BudgetPeriod.js';
import { Money } from '../shared/Money.js';
import { HouseholdId } from '../identity/household/HouseholdId.js';
import { CategoryId } from '../catalogue/category/CategoryId.js';
import { GroupId } from '../catalogue/group/GroupId.js';

export class BudgetLimit {
  private constructor(
    readonly id: BudgetLimitId,
    readonly householdId: HouseholdId,
    readonly money: Money,
    readonly period: BudgetPeriod,
    readonly categoryId?: CategoryId,
    readonly groupId?: GroupId,
  ) {
    if (!!categoryId === !!groupId) throw new Error('BudgetLimit must target exactly one of categoryId or groupId');
  }

  static forCategory(
    id: BudgetLimitId,
    householdId: HouseholdId,
    money: Money,
    period: BudgetPeriod,
    categoryId: CategoryId,
  ): BudgetLimit {
    return new BudgetLimit(id, householdId, money, period, categoryId, undefined);
  }

  static forGroup(
    id: BudgetLimitId,
    householdId: HouseholdId,
    money: Money,
    period: BudgetPeriod,
    groupId: GroupId,
  ): BudgetLimit {
    return new BudgetLimit(id, householdId, money, period, undefined, groupId);
  }

  edit(money: Money, period: BudgetPeriod): BudgetLimit {
    return new BudgetLimit(this.id, this.householdId, money, period, this.categoryId, this.groupId);
  }
}
