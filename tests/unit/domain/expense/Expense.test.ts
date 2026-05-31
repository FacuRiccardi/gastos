import { describe, it, expect } from 'vitest';
import { Expense } from '../../../../src/domain/expense/Expense.js';
import { ExpenseId } from '../../../../src/domain/expense/ExpenseId.js';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { InstallmentPlan } from '../../../../src/domain/expense/InstallmentPlan.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { PaymentInstrumentId } from '../../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentMethod } from '../../../../src/domain/expense/PaymentMethod.js';

describe('Expense', () => {
  const expenseId = ExpenseId.generate();
  const householdId = HouseholdId.generate();
  const userId = UserId.generate();
  const categoryId = CategoryId.generate();
  const money = new Money(500, Currency.ARS);
  const date = new ExpenseDate(new Date('2024-03-15'));
  const instrumentId = PaymentInstrumentId.generate();

  describe('valid construction — Cash payment', () => {
    it('creates an Expense with Cash payment method', () => {
      const cashPayment = PaymentMethod.cash();
      const expense = new Expense(expenseId, householdId, userId, categoryId, money, date, cashPayment);
      expect(expense.id).toBe(expenseId);
      expect(expense.householdId).toBe(householdId);
      expect(expense.userId).toBe(userId);
      expect(expense.categoryId).toBe(categoryId);
      expect(expense.money).toBe(money);
      expect(expense.date).toBe(date);
    });

    it('Cash expense has no InstallmentPlan', () => {
      const cashPayment = PaymentMethod.cash();
      const expense = new Expense(expenseId, householdId, userId, categoryId, money, date, cashPayment);
      expect(expense.installmentPlan).toBeNull();
    });
  });

  describe('valid construction — BankAccount payment', () => {
    it('creates an Expense with BankAccount payment method', () => {
      const bankPayment = PaymentMethod.bankAccount(instrumentId);
      const expense = new Expense(expenseId, householdId, userId, categoryId, money, date, bankPayment);
      expect(expense.paymentMethod).toEqual(bankPayment);
    });

    it('BankAccount expense has no InstallmentPlan', () => {
      const bankPayment = PaymentMethod.bankAccount(instrumentId);
      const expense = new Expense(expenseId, householdId, userId, categoryId, money, date, bankPayment);
      expect(expense.installmentPlan).toBeNull();
    });
  });

  describe('valid construction — CreditCard payment', () => {
    it('creates an Expense with CreditCard payment and InstallmentPlan', () => {
      const creditPayment = PaymentMethod.creditCard(instrumentId);
      const installments = new InstallmentPlan(3);
      const expense = new Expense(expenseId, householdId, userId, categoryId, money, date, creditPayment, installments);
      expect(expense.paymentMethod).toEqual(creditPayment);
      expect(expense.installmentPlan).toBe(installments);
    });
  });

  describe('invariants — InstallmentPlan and PaymentMethod coupling', () => {
    it('rejects Cash expense with an InstallmentPlan', () => {
      const cashPayment = PaymentMethod.cash();
      const installments = new InstallmentPlan(3);
      expect(() => new Expense(expenseId, householdId, userId, categoryId, money, date, cashPayment, installments)).toThrow();
    });

    it('rejects BankAccount expense with an InstallmentPlan', () => {
      const bankPayment = PaymentMethod.bankAccount(instrumentId);
      const installments = new InstallmentPlan(3);
      expect(() => new Expense(expenseId, householdId, userId, categoryId, money, date, bankPayment, installments)).toThrow();
    });

    it('rejects CreditCard expense without an InstallmentPlan', () => {
      const creditPayment = PaymentMethod.creditCard(instrumentId);
      expect(() => new Expense(expenseId, householdId, userId, categoryId, money, date, creditPayment)).toThrow();
    });
  });

  describe('invariants — required fields', () => {
    it('requires an ExpenseId', () => {
      const cashPayment = PaymentMethod.cash();
      expect(() => new Expense(null as unknown as ExpenseId, householdId, userId, categoryId, money, date, cashPayment)).toThrow();
    });

    it('requires a HouseholdId', () => {
      const cashPayment = PaymentMethod.cash();
      expect(() => new Expense(expenseId, null as unknown as HouseholdId, userId, categoryId, money, date, cashPayment)).toThrow();
    });

    it('requires a UserId', () => {
      const cashPayment = PaymentMethod.cash();
      expect(() => new Expense(expenseId, householdId, null as unknown as UserId, categoryId, money, date, cashPayment)).toThrow();
    });

    it('requires a CategoryId', () => {
      const cashPayment = PaymentMethod.cash();
      expect(() => new Expense(expenseId, householdId, userId, null as unknown as CategoryId, money, date, cashPayment)).toThrow();
    });

    it('requires Money', () => {
      const cashPayment = PaymentMethod.cash();
      expect(() => new Expense(expenseId, householdId, userId, categoryId, null as unknown as Money, date, cashPayment)).toThrow();
    });

    it('requires an ExpenseDate', () => {
      const cashPayment = PaymentMethod.cash();
      expect(() => new Expense(expenseId, householdId, userId, categoryId, money, null as unknown as ExpenseDate, cashPayment)).toThrow();
    });
  });

  describe('ownership', () => {
    it('belongs to exactly one User', () => {
      const cashPayment = PaymentMethod.cash();
      const expense = new Expense(expenseId, householdId, userId, categoryId, money, date, cashPayment);
      expect(expense.userId).toBe(userId);
    });

    it('belongs to a Household', () => {
      const cashPayment = PaymentMethod.cash();
      const expense = new Expense(expenseId, householdId, userId, categoryId, money, date, cashPayment);
      expect(expense.householdId).toBe(householdId);
    });
  });
});
