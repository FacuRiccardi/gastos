import { ExpenseId } from './ExpenseId.js';
import { ExpenseDate } from './ExpenseDate.js';
import { InstallmentPlan } from './InstallmentPlan.js';
import { PaymentMethod } from './PaymentMethod.js';
import { Money } from '../shared/Money.js';
import { HouseholdId } from '../identity/household/HouseholdId.js';
import { UserId } from '../identity/user/UserId.js';
import { CategoryId } from '../catalogue/category/CategoryId.js';
import { DomainError } from '../shared/DomainError.js';

export class Expense {
  constructor(
    readonly id: ExpenseId,
    readonly householdId: HouseholdId,
    readonly userId: UserId,
    readonly categoryId: CategoryId,
    readonly money: Money,
    readonly paymentMethod: PaymentMethod,
    readonly date: ExpenseDate,
    readonly installmentPlan?: InstallmentPlan,
  ) {
    const isCreditCard = paymentMethod.kind === 'CreditCard';
    if (isCreditCard && installmentPlan === undefined) {
      throw new DomainError('CreditCard payment requires an InstallmentPlan');
    }
    if (!isCreditCard && installmentPlan !== undefined) {
      throw new DomainError('InstallmentPlan is only valid for CreditCard payments');
    }
  }
}
