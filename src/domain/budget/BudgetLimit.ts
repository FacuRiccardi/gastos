import { BudgetLimitId } from './BudgetLimitId.js';
import { BudgetPeriod } from './BudgetPeriod.js';
import { Money } from '../shared/Money.js';
import { HouseholdId } from '../identity/household/HouseholdId.js';
import { CategoryId } from '../catalogue/category/CategoryId.js';
import { GroupId } from '../catalogue/group/GroupId.js';

export class BudgetLimit {
  readonly id: BudgetLimitId;
  readonly householdId: HouseholdId;
  readonly cap: Money;
  readonly period: BudgetPeriod;
  readonly categoryId: CategoryId | null;
  readonly groupId: GroupId | null;

  private constructor(
    id: BudgetLimitId,
    householdId: HouseholdId,
    cap: Money,
    period: BudgetPeriod,
    categoryId: CategoryId | null,
    groupId: GroupId | null,
  ) {
    if (!householdId) throw new Error('HouseholdId is required');
    if (!cap) throw new Error('cap Money is required');
    if (!period) throw new Error('BudgetPeriod is required');
    this.id = id;
    this.householdId = householdId;
    this.cap = cap;
    this.period = period;
    this.categoryId = categoryId;
    this.groupId = groupId;
  }

  static forCategory(id: BudgetLimitId, householdId: HouseholdId, cap: Money, period: BudgetPeriod, categoryId: CategoryId): BudgetLimit {
    if (!categoryId) throw new Error('CategoryId is required');
    return new BudgetLimit(id, householdId, cap, period, categoryId, null);
  }

  static forGroup(id: BudgetLimitId, householdId: HouseholdId, cap: Money, period: BudgetPeriod, groupId: GroupId): BudgetLimit {
    if (!groupId) throw new Error('GroupId is required');
    return new BudgetLimit(id, householdId, cap, period, null, groupId);
  }

  editCap(cap: Money): BudgetLimit {
    return new BudgetLimit(this.id, this.householdId, cap, this.period, this.categoryId, this.groupId);
  }

  editPeriod(period: BudgetPeriod): BudgetLimit {
    return new BudgetLimit(this.id, this.householdId, this.cap, period, this.categoryId, this.groupId);
  }
}
