import { describe, it, expect } from 'vitest';
import { Expense } from '../../../../src/domain/expense/Expense.js';
import { ExpenseId } from '../../../../src/domain/expense/ExpenseId.js';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';
import { InstallmentPlan } from '../../../../src/domain/expense/InstallmentPlan.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { PaymentInstrumentId } from '../../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';

const id = ExpenseId.generate();
const householdId = HouseholdId.generate();
const userId = UserId.generate();
const categoryId = CategoryId.generate();
const money = new Money(500, Currency.ARS);
const date = new ExpenseDate(new Date('2025-05-01'));
const instrumentId = PaymentInstrumentId.generate();

describe('Expense', () => {
  it('constructs with Cash payment and no InstallmentPlan', () => {
    const expense = new Expense(id, householdId, userId, categoryId, money, { kind: 'Cash' }, date);
    expect(expense).toBeDefined();
  });

  it('constructs with CreditCard payment and an InstallmentPlan', () => {
    const plan = new InstallmentPlan(3);
    const expense = new Expense(
      id, householdId, userId, categoryId, money,
      { kind: 'CreditCard', instrumentId },
      date,
      plan,
    );
    expect(expense).toBeDefined();
  });

  it('constructs with BankAccount payment and no InstallmentPlan', () => {
    const expense = new Expense(
      id, householdId, userId, categoryId, money,
      { kind: 'BankAccount', instrumentId },
      date,
    );
    expect(expense).toBeDefined();
  });

  it('rejects a CreditCard payment without an InstallmentPlan', () => {
    expect(() =>
      new Expense(id, householdId, userId, categoryId, money, { kind: 'CreditCard', instrumentId }, date),
    ).toThrow();
  });

  it('rejects a Cash payment with an InstallmentPlan', () => {
    expect(() =>
      new Expense(id, householdId, userId, categoryId, money, { kind: 'Cash' }, date, new InstallmentPlan(3)),
    ).toThrow();
  });

  it('rejects a BankAccount payment with an InstallmentPlan', () => {
    expect(() =>
      new Expense(
        id, householdId, userId, categoryId, money,
        { kind: 'BankAccount', instrumentId },
        date,
        new InstallmentPlan(3),
      ),
    ).toThrow();
  });
});
