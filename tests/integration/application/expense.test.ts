import { describe, it, expect, beforeEach } from 'vitest';
import { clearTables } from '../helpers/testDb.js';
import { makeRepos } from '../helpers/repositories.js';
import { CreatePaymentInstrument } from '../../../src/application/expense/payment-instrument/CreatePaymentInstrument.js';
import { RenamePaymentInstrument } from '../../../src/application/expense/payment-instrument/RenamePaymentInstrument.js';
import { SoftDeletePaymentInstrument } from '../../../src/application/expense/payment-instrument/SoftDeletePaymentInstrument.js';
import { ListPaymentInstruments } from '../../../src/application/expense/payment-instrument/ListPaymentInstruments.js';
import { LogExpense } from '../../../src/application/expense/LogExpense.js';
import { DeleteExpense } from '../../../src/application/expense/DeleteExpense.js';
import { ListExpenses } from '../../../src/application/expense/ListExpenses.js';
import { CreateGroup } from '../../../src/application/catalogue/CreateGroup.js';
import { CreateCategory } from '../../../src/application/catalogue/CreateCategory.js';
import { PaymentInstrumentType } from '../../../src/domain/expense/payment-instrument/PaymentInstrumentType.js';
import { PaymentInstrumentId } from '../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { Money } from '../../../src/domain/shared/Money.js';
import { Currency } from '../../../src/domain/shared/Currency.js';
import { ExpenseDate } from '../../../src/domain/expense/ExpenseDate.js';
import { ExpenseFilters } from '../../../src/domain/expense/ExpenseFilters.js';
import { Pagination } from '../../../src/domain/shared/Pagination.js';
import { HouseholdId } from '../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../src/domain/identity/user/UserId.js';
import { CategoryId } from '../../../src/domain/catalogue/category/CategoryId.js';

describe('Expense use cases (integration)', () => {
  const householdId = HouseholdId.generate();
  const userId = UserId.generate();
  const money = new Money(1000, Currency.ARS);
  const date = new ExpenseDate(new Date(2025, 5, 1));
  const pagination = new Pagination(10, 0);
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(async () => {
    await clearTables();
    repos = makeRepos();
  });

  async function seedCategory() {
    const { id: groupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'G' });
    const { id: categoryId } = await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'C' });
    return categoryId;
  }

  async function seedCreditCardInstrument() {
    const { id } = await new CreatePaymentInstrument(repos.paymentInstruments).execute({
      userId,
      type: PaymentInstrumentType.CreditCard,
      name: 'Visa',
    });
    return id;
  }

  describe('CreatePaymentInstrument', () => {
    it('persists an instrument retrievable by findActiveByUser', async () => {
      const { id } = await new CreatePaymentInstrument(repos.paymentInstruments).execute({
        userId,
        type: PaymentInstrumentType.BankAccount,
        name: 'Savings',
      });

      const { instruments } = await new ListPaymentInstruments(repos.paymentInstruments).execute({ userId });
      expect(instruments).toHaveLength(1);
      expect(instruments[0]!.id).toBe(id);
    });
  });

  describe('RenamePaymentInstrument', () => {
    it('persists the new name', async () => {
      const { id } = await new CreatePaymentInstrument(repos.paymentInstruments).execute({
        userId, type: PaymentInstrumentType.CreditCard, name: 'Old',
      });

      await new RenamePaymentInstrument(repos.paymentInstruments).execute({ id, newName: 'New' });

      const found = await repos.paymentInstruments.findById(id);
      expect(found!.name).toBe('New');
    });
  });

  describe('SoftDeletePaymentInstrument', () => {
    it('soft-deleted instrument disappears from ListPaymentInstruments', async () => {
      const { id } = await new CreatePaymentInstrument(repos.paymentInstruments).execute({
        userId, type: PaymentInstrumentType.CreditCard, name: 'Card',
      });

      await new SoftDeletePaymentInstrument(repos.paymentInstruments).execute({ id });

      const { instruments } = await new ListPaymentInstruments(repos.paymentInstruments).execute({ userId });
      expect(instruments).toHaveLength(0);
      const found = await repos.paymentInstruments.findById(id);
      expect(found!.isDeleted).toBe(true);
    });
  });

  describe('ListPaymentInstruments', () => {
    it('returns only active instruments belonging to the given user', async () => {
      const otherId = UserId.generate();
      await new CreatePaymentInstrument(repos.paymentInstruments).execute({ userId, type: PaymentInstrumentType.CreditCard, name: 'Mine' });
      await new CreatePaymentInstrument(repos.paymentInstruments).execute({ userId: otherId, type: PaymentInstrumentType.CreditCard, name: 'Theirs' });
      const { id: deletedId } = await new CreatePaymentInstrument(repos.paymentInstruments).execute({ userId, type: PaymentInstrumentType.BankAccount, name: 'Deleted' });
      await new SoftDeletePaymentInstrument(repos.paymentInstruments).execute({ id: deletedId });

      const { instruments } = await new ListPaymentInstruments(repos.paymentInstruments).execute({ userId });

      expect(instruments).toHaveLength(1);
      expect(instruments[0]!.name).toBe('Mine');
    });
  });

  describe('LogExpense', () => {
    it('persists a cash expense retrievable by id', async () => {
      const categoryId = await seedCategory();

      const { id } = await new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments).execute({
        householdId, userId, categoryId, money, paymentMethod: { kind: 'Cash' }, date,
      });

      const found = await repos.expenses.findById(id);
      expect(found).not.toBeNull();
      expect(found!.money.amount).toBe(1000);
    });

    it('persists a credit card expense with installment plan', async () => {
      const categoryId = await seedCategory();
      const instrumentId = await seedCreditCardInstrument();
      const { InstallmentPlan } = await import('../../../src/domain/expense/InstallmentPlan.js');

      const { id } = await new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments).execute({
        householdId, userId, categoryId, money,
        paymentMethod: { kind: 'CreditCard', instrumentId },
        date,
        installmentPlan: new InstallmentPlan(6),
      });

      const found = await repos.expenses.findById(id);
      expect(found!.installmentPlan?.count).toBe(6);
    });

    it('throws when category does not exist', async () => {
      await expect(
        new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments).execute({
          householdId, userId, categoryId: CategoryId.generate(), money,
          paymentMethod: { kind: 'Cash' }, date,
        }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Category not found' });
    });

    it('throws when credit card instrument does not exist', async () => {
      const categoryId = await seedCategory();

      await expect(
        new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments).execute({
          householdId, userId, categoryId, money,
          paymentMethod: { kind: 'CreditCard', instrumentId: PaymentInstrumentId.generate() },
          date,
        }),
      ).rejects.toMatchObject({ type: 'Application', message: 'PaymentInstrument not found' });
    });
  });

  describe('DeleteExpense', () => {
    it('removes the expense so it can no longer be found', async () => {
      const categoryId = await seedCategory();
      const { id } = await new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments).execute({
        householdId, userId, categoryId, money, paymentMethod: { kind: 'Cash' }, date,
      });

      await new DeleteExpense(repos.expenses).execute({ id, householdId });

      const found = await repos.expenses.findById(id);
      expect(found).toBeNull();
    });
  });

  describe('ListExpenses', () => {
    it('returns paginated expenses for the household', async () => {
      const categoryId = await seedCategory();
      const logExpense = new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments);
      for (let i = 0; i < 3; i++) {
        await logExpense.execute({ householdId, userId, categoryId, money, paymentMethod: { kind: 'Cash' }, date });
      }

      const { page } = await new ListExpenses(repos.expenses, repos.categories).execute({
        householdId, filters: new ExpenseFilters(), pagination,
      });

      expect(page.total).toBe(3);
      expect(page.items).toHaveLength(3);
    });

    it('resolves group filter by expanding to category ids', async () => {
      const { id: groupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'Target Group' });
      const { id: catInGroup } = await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'Cat1' });
      const otherCategoryId = await seedCategory();
      const logExpense = new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments);
      await logExpense.execute({ householdId, userId, categoryId: catInGroup, money, paymentMethod: { kind: 'Cash' }, date });
      await logExpense.execute({ householdId, userId, categoryId: otherCategoryId, money, paymentMethod: { kind: 'Cash' }, date });

      const { page } = await new ListExpenses(repos.expenses, repos.categories).execute({
        householdId, filters: new ExpenseFilters(), groupId, pagination,
      });

      expect(page.total).toBe(1);
      expect(page.items[0]!.categoryId).toBe(catInGroup);
    });
  });
});
