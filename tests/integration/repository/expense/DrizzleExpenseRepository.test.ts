import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearTables } from '../../helpers/testDb.js';
import { DrizzleExpenseRepository } from '../../../../src/infrastructure/expense/DrizzleExpenseRepository.js';
import { Expense } from '../../../../src/domain/expense/Expense.js';
import { ExpenseId } from '../../../../src/domain/expense/ExpenseId.js';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';
import { ExpenseFilters } from '../../../../src/domain/expense/ExpenseFilters.js';
import { InstallmentPlan } from '../../../../src/domain/expense/InstallmentPlan.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { Pagination } from '../../../../src/domain/shared/Pagination.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { PaymentInstrumentId } from '../../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';

describe('DrizzleExpenseRepository', () => {
  let repo: DrizzleExpenseRepository;
  const householdId = HouseholdId.generate();
  const userId = UserId.generate();
  const categoryId = CategoryId.generate();
  const instrumentId = PaymentInstrumentId.generate();
  const money = new Money(1500, Currency.ARS);
  const date = new ExpenseDate(new Date(2025, 5, 1));
  const pagination = new Pagination(10, 0);

  beforeEach(async () => {
    await clearTables();
    repo = new DrizzleExpenseRepository(testDb);
  });

  it('saves and retrieves a Cash Expense with all fields intact', async () => {
    const id = ExpenseId.generate();
    const expense = new Expense(id, householdId, userId, categoryId, money, { kind: 'Cash' }, date);

    await repo.save(expense);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.householdId).toBe(householdId);
    expect(found!.userId).toBe(userId);
    expect(found!.categoryId).toBe(categoryId);
    expect(found!.money.amount).toBe(1500);
    expect(found!.money.currency.code).toBe('ARS');
    expect(found!.paymentMethod.kind).toBe('Cash');
    expect(found!.date.toDate().toDateString()).toBe(date.toDate().toDateString());
  });

  it('saves and retrieves a CreditCard Expense with PaymentInstrumentId and InstallmentPlan', async () => {
    const id = ExpenseId.generate();
    const expense = new Expense(
      id, householdId, userId, categoryId, money,
      { kind: 'CreditCard', instrumentId },
      date,
      new InstallmentPlan(3),
    );

    await repo.save(expense);
    const found = await repo.findById(id);

    expect(found!.paymentMethod.kind).toBe('CreditCard');
    expect((found!.paymentMethod as { kind: 'CreditCard'; instrumentId: PaymentInstrumentId }).instrumentId).toBe(instrumentId);
    expect(found!.installmentPlan?.count).toBe(3);
  });

  it('saves and retrieves a BankAccount Expense with PaymentInstrumentId and no InstallmentPlan', async () => {
    const id = ExpenseId.generate();
    const expense = new Expense(id, householdId, userId, categoryId, money, { kind: 'BankAccount', instrumentId }, date);

    await repo.save(expense);
    const found = await repo.findById(id);

    expect(found!.paymentMethod.kind).toBe('BankAccount');
    expect(found!.installmentPlan).toBeUndefined();
  });

  it('returns null for an unknown ExpenseId', async () => {
    const found = await repo.findById(ExpenseId.generate());
    expect(found).toBeNull();
  });

  it('delete() removes the Expense; findById() returns null afterwards', async () => {
    const id = ExpenseId.generate();
    await repo.save(new Expense(id, householdId, userId, categoryId, money, { kind: 'Cash' }, date));

    await repo.delete(id);
    const found = await repo.findById(id);

    expect(found).toBeNull();
  });

  it('save() with existing id overwrites the previous state', async () => {
    const id = ExpenseId.generate();
    const original = new Expense(id, householdId, userId, categoryId, money, { kind: 'Cash' }, date);
    await repo.save(original);

    const newMoney = new Money(2000, Currency.ARS);
    const updated = new Expense(id, householdId, userId, categoryId, newMoney, { kind: 'Cash' }, date);
    await repo.save(updated);
    const found = await repo.findById(id);

    expect(found!.money.amount).toBe(2000);
  });

  it('findByHousehold() returns only Expenses for the given Household', async () => {
    const otherId = HouseholdId.generate();
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'Cash' }, date));
    await repo.save(new Expense(ExpenseId.generate(), otherId, userId, categoryId, money, { kind: 'Cash' }, date));

    const page = await repo.findByHousehold(householdId, new ExpenseFilters(), pagination);

    expect(page.total).toBe(1);
    expect(page.items[0]!.householdId).toBe(householdId);
  });

  it('findByHousehold() filters by date range', async () => {
    const jan = new ExpenseDate(new Date(2025, 0, 15));
    const mar = new ExpenseDate(new Date(2025, 2, 15));
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'Cash' }, jan));
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'Cash' }, mar));

    const filters = new ExpenseFilters(new ExpenseDate(new Date(2025, 1, 1)), new ExpenseDate(new Date(2025, 3, 1)));
    const page = await repo.findByHousehold(householdId, filters, pagination);

    expect(page.total).toBe(1);
    expect(page.items[0]!.date.toDate().getMonth()).toBe(2);
  });

  it('findByHousehold() filters by categoryId', async () => {
    const otherCategoryId = CategoryId.generate();
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'Cash' }, date));
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, otherCategoryId, money, { kind: 'Cash' }, date));

    const filters = new ExpenseFilters(undefined, undefined, [categoryId]);
    const page = await repo.findByHousehold(householdId, filters, pagination);

    expect(page.total).toBe(1);
    expect(page.items[0]!.categoryId).toBe(categoryId);
  });

  it('findByHousehold() filters by paymentInstrumentId', async () => {
    const otherId = PaymentInstrumentId.generate();
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'CreditCard', instrumentId }, date, new InstallmentPlan(1)));
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'Cash' }, date));
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'CreditCard', instrumentId: otherId }, date, new InstallmentPlan(1)));

    const filters = new ExpenseFilters(undefined, undefined, undefined, instrumentId);
    const page = await repo.findByHousehold(householdId, filters, pagination);

    expect(page.total).toBe(1);
  });

  it('findByHousehold() paginates correctly (limit, offset, total count)', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'Cash' }, date));
    }

    const page = await repo.findByHousehold(householdId, new ExpenseFilters(), new Pagination(2, 1));

    expect(page.total).toBe(5);
    expect(page.items).toHaveLength(2);
  });

  it('sumAmountByHousehold() returns the correct total for a filtered set', async () => {
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, new Money(1000, Currency.ARS), { kind: 'Cash' }, date));
    await repo.save(new Expense(ExpenseId.generate(), householdId, userId, categoryId, new Money(500, Currency.ARS), { kind: 'Cash' }, date));
    await repo.save(new Expense(ExpenseId.generate(), HouseholdId.generate(), userId, categoryId, money, { kind: 'Cash' }, date));

    const total = await repo.sumAmountByHousehold(householdId, new ExpenseFilters());

    expect(total).toBe(1500);
  });

  it('reconstructs the ExpenseDate value object correctly', async () => {
    const id = ExpenseId.generate();
    const specificDate = new ExpenseDate(new Date(2025, 5, 15));
    await repo.save(new Expense(id, householdId, userId, categoryId, money, { kind: 'Cash' }, specificDate));

    const found = await repo.findById(id);

    expect(found!.date.toDate().getFullYear()).toBe(2025);
    expect(found!.date.toDate().getMonth()).toBe(5);
    expect(found!.date.toDate().getDate()).toBe(15);
  });

  it('reconstructs the Money value object (amount as number, Currency from code)', async () => {
    const id = ExpenseId.generate();
    await repo.save(new Expense(id, householdId, userId, categoryId, new Money(9999.99, Currency.ARS), { kind: 'Cash' }, date));

    const found = await repo.findById(id);

    expect(found!.money.amount).toBe(9999.99);
    expect(found!.money.currency.code).toBe('ARS');
  });
});
