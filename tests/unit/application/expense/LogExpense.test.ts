import { describe, it, expect, beforeEach } from 'vitest';
import { LogExpense } from '../../../../src/application/expense/LogExpense.js';
import { InMemoryExpenseRepository } from '../../../helpers/InMemoryExpenseRepository.js';
import { InMemoryCategoryRepository } from '../../../helpers/InMemoryCategoryRepository.js';
import { InMemoryPaymentInstrumentRepository } from '../../../helpers/InMemoryPaymentInstrumentRepository.js';
import { Category } from '../../../../src/domain/catalogue/category/Category.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';
import { PaymentInstrument } from '../../../../src/domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentId } from '../../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentType } from '../../../../src/domain/expense/payment-instrument/PaymentInstrumentType.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';
import { InstallmentPlan } from '../../../../src/domain/expense/InstallmentPlan.js';
import { ApplicationError } from '../../../../src/application/ApplicationError.js';

describe('Expense / LogExpense', () => {
  let expenses: InMemoryExpenseRepository;
  let categories: InMemoryCategoryRepository;
  let instruments: InMemoryPaymentInstrumentRepository;
  let useCase: LogExpense;

  const householdId = HouseholdId.generate();
  const userId = UserId.generate();
  const groupId = GroupId.generate();
  const money = new Money(100, Currency.ARS);
  const date = new ExpenseDate(new Date('2024-01-15'));

  let categoryId: CategoryId;

  beforeEach(() => {
    expenses = new InMemoryExpenseRepository();
    categories = new InMemoryCategoryRepository();
    instruments = new InMemoryPaymentInstrumentRepository();
    useCase = new LogExpense(expenses, categories, instruments);

    categoryId = CategoryId.generate();
  });

  it('persists a cash expense and returns its id', async () => {
    await categories.save(new Category(categoryId, householdId, groupId, 'Food'));

    const result = await useCase.execute({
      householdId,
      userId,
      categoryId,
      money,
      paymentMethod: { kind: 'Cash' },
      date,
    });

    const saved = await expenses.findById(result.id);
    expect(saved).not.toBeNull();
    expect(saved!.money).toEqual(money);
    expect(saved!.paymentMethod).toEqual({ kind: 'Cash' });
  });

  it('persists a bank-account expense and returns its id', async () => {
    await categories.save(new Category(categoryId, householdId, groupId, 'Food'));
    const instrumentId = PaymentInstrumentId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, userId, PaymentInstrumentType.BankAccount, 'Checking'));

    const result = await useCase.execute({
      householdId,
      userId,
      categoryId,
      money,
      paymentMethod: { kind: 'BankAccount', instrumentId },
      date,
    });

    const saved = await expenses.findById(result.id);
    expect(saved).not.toBeNull();
    expect(saved!.paymentMethod).toEqual({ kind: 'BankAccount', instrumentId });
  });

  it('persists a credit-card expense with an installment plan and returns its id', async () => {
    await categories.save(new Category(categoryId, householdId, groupId, 'Food'));
    const instrumentId = PaymentInstrumentId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, userId, PaymentInstrumentType.CreditCard, 'Visa'));

    const result = await useCase.execute({
      householdId,
      userId,
      categoryId,
      money,
      paymentMethod: { kind: 'CreditCard', instrumentId },
      date,
      installmentPlan: new InstallmentPlan(3),
    });

    const saved = await expenses.findById(result.id);
    expect(saved).not.toBeNull();
    expect(saved!.installmentPlan?.count).toBe(3);
  });

  it('throws when the category does not exist', async () => {
    await expect(
      useCase.execute({
        householdId,
        userId,
        categoryId: CategoryId.generate(),
        money,
        paymentMethod: { kind: 'Cash' },
        date,
      }),
    ).rejects.toThrow(ApplicationError);
  });

  it('throws when a credit-card payment references an instrument that does not exist', async () => {
    await categories.save(new Category(categoryId, householdId, groupId, 'Food'));

    await expect(
      useCase.execute({
        householdId,
        userId,
        categoryId,
        money,
        paymentMethod: { kind: 'CreditCard', instrumentId: PaymentInstrumentId.generate() },
        date,
        installmentPlan: new InstallmentPlan(1),
      }),
    ).rejects.toThrow(ApplicationError);
  });

  it('throws when a credit-card payment references an instrument that is not of type CreditCard', async () => {
    await categories.save(new Category(categoryId, householdId, groupId, 'Food'));
    const instrumentId = PaymentInstrumentId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, userId, PaymentInstrumentType.BankAccount, 'Checking'));

    await expect(
      useCase.execute({
        householdId,
        userId,
        categoryId,
        money,
        paymentMethod: { kind: 'CreditCard', instrumentId },
        date,
        installmentPlan: new InstallmentPlan(1),
      }),
    ).rejects.toThrow(ApplicationError);
  });

  it('throws when the category is soft-deleted', async () => {
    await categories.save(new Category(categoryId, householdId, groupId, 'Food', new Date()));

    await expect(
      useCase.execute({ householdId, userId, categoryId, money, paymentMethod: { kind: 'Cash' }, date }),
    ).rejects.toThrow(ApplicationError);
  });

  it('throws when a bank-account payment references an instrument that does not exist', async () => {
    await categories.save(new Category(categoryId, householdId, groupId, 'Food'));

    await expect(
      useCase.execute({
        householdId,
        userId,
        categoryId,
        money,
        paymentMethod: { kind: 'BankAccount', instrumentId: PaymentInstrumentId.generate() },
        date,
      }),
    ).rejects.toThrow(ApplicationError);
  });

  it('throws when a bank-account payment references an instrument that is not of type BankAccount', async () => {
    await categories.save(new Category(categoryId, householdId, groupId, 'Food'));
    const instrumentId = PaymentInstrumentId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, userId, PaymentInstrumentType.CreditCard, 'Visa'));

    await expect(
      useCase.execute({
        householdId,
        userId,
        categoryId,
        money,
        paymentMethod: { kind: 'BankAccount', instrumentId },
        date,
      }),
    ).rejects.toThrow(ApplicationError);
  });
});
