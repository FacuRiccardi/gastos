import { ExpenseId } from './ExpenseId.js';
import { ExpenseDate } from './ExpenseDate.js';
import { PaymentMethod } from './PaymentMethod.js';
import { InstallmentPlan } from './InstallmentPlan.js';
import { Money } from '../shared/Money.js';
import { HouseholdId } from '../identity/household/HouseholdId.js';
import { UserId } from '../identity/user/UserId.js';
import { CategoryId } from '../catalogue/category/CategoryId.js';

export class Expense {
  readonly id: ExpenseId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly categoryId: CategoryId;
  readonly money: Money;
  readonly date: ExpenseDate;
  readonly paymentMethod: PaymentMethod;
  readonly installmentPlan: InstallmentPlan | null;

  constructor(
    id: ExpenseId,
    householdId: HouseholdId,
    userId: UserId,
    categoryId: CategoryId,
    money: Money,
    date: ExpenseDate,
    paymentMethod: PaymentMethod,
    installmentPlan?: InstallmentPlan,
  ) {
    if (!id) throw new Error('ExpenseId is required');
    if (!householdId) throw new Error('HouseholdId is required');
    if (!userId) throw new Error('UserId is required');
    if (!categoryId) throw new Error('CategoryId is required');
    if (!money) throw new Error('Money is required');
    if (!date) throw new Error('ExpenseDate is required');

    const isCreditCard = paymentMethod.kind === 'CreditCard';
    if (isCreditCard && !installmentPlan) throw new Error('CreditCard expense requires an InstallmentPlan');
    if (!isCreditCard && installmentPlan) throw new Error('InstallmentPlan is only valid for CreditCard payments');

    this.id = id;
    this.householdId = householdId;
    this.userId = userId;
    this.categoryId = categoryId;
    this.money = money;
    this.date = date;
    this.paymentMethod = paymentMethod;
    this.installmentPlan = installmentPlan ?? null;
  }
}
