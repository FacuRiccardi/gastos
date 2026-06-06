import { ExpenseId } from '../../domain/expense/ExpenseId.js';
import { Expense } from '../../domain/expense/Expense.js';
import { ExpenseDate } from '../../domain/expense/ExpenseDate.js';
import { InstallmentPlan } from '../../domain/expense/InstallmentPlan.js';
import { PaymentMethod } from '../../domain/expense/PaymentMethod.js';
import { ExpenseRepository } from '../../domain/expense/ExpenseRepository.js';
import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { PaymentInstrumentRepository } from '../../domain/expense/payment-instrument/PaymentInstrumentRepository.js';
import { PaymentInstrumentType } from '../../domain/expense/payment-instrument/PaymentInstrumentType.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { UserId } from '../../domain/identity/user/UserId.js';
import { Money } from '../../domain/shared/Money.js';
import { ApplicationError } from '../ApplicationError.js';

export interface LogExpenseInput {
  householdId: HouseholdId;
  userId: UserId;
  categoryId: CategoryId;
  money: Money;
  paymentMethod: PaymentMethod;
  date: ExpenseDate;
  installmentPlan?: InstallmentPlan;
}

export type LogExpenseOutput = { id: ExpenseId };

export class LogExpense {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly categories: CategoryRepository,
    private readonly instruments: PaymentInstrumentRepository,
  ) {}

  async execute(input: LogExpenseInput): Promise<LogExpenseOutput> {
    const category = await this.categories.findById(input.categoryId);
    if (!category || category.householdId !== input.householdId) throw new ApplicationError('Category not found');
    if (category.isDeleted) throw new ApplicationError('Category is deleted');

    const kind = input.paymentMethod.kind;
    if (kind === 'CreditCard' || kind === 'BankAccount') {
      const instrument = await this.instruments.findById(input.paymentMethod.instrumentId);
      if (!instrument || instrument.userId !== input.userId) throw new ApplicationError('PaymentInstrument not found');
      if (instrument.isDeleted) throw new ApplicationError('PaymentInstrument has been deleted');
      if (instrument.type !== PaymentInstrumentType[kind]) {
        throw new ApplicationError(`PaymentInstrument must be of type ${kind}`);
      }
    }

    const id = ExpenseId.generate();
    const expense = new Expense(
      id,
      input.householdId,
      input.userId,
      input.categoryId,
      input.money,
      input.paymentMethod,
      input.date,
      input.installmentPlan,
    );
    await this.expenses.save(expense);
    return { id };
  }
}
