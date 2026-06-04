import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteExpense } from '../../../../src/application/expense/DeleteExpense.js';
import { ListExpenses } from '../../../../src/application/expense/ListExpenses.js';
import { InMemoryExpenseRepository } from '../../../helpers/InMemoryExpenseRepository.js';
import { InMemoryCategoryRepository } from '../../../helpers/InMemoryCategoryRepository.js';
import { Expense } from '../../../../src/domain/expense/Expense.js';
import { ExpenseId } from '../../../../src/domain/expense/ExpenseId.js';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';
import { ExpenseFilters } from '../../../../src/domain/expense/ExpenseFilters.js';
import { Category } from '../../../../src/domain/catalogue/category/Category.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { Pagination } from '../../../../src/domain/shared/Pagination.js';
import { ApplicationError } from '../../../../src/application/ApplicationError.js';

const householdId = HouseholdId.generate();
const userId = UserId.generate();
const groupId = GroupId.generate();
const money = new Money(50, Currency.ARS);
const date = new ExpenseDate(new Date('2024-03-01'));

function makeExpense(id: ExpenseId, categoryId: CategoryId): Expense {
  return new Expense(id, householdId, userId, categoryId, money, { kind: 'Cash' }, date);
}

describe('Expense / DeleteExpense', () => {
  let expenses: InMemoryExpenseRepository;

  beforeEach(() => {
    expenses = new InMemoryExpenseRepository();
  });

  it('deletes the expense from the repository', async () => {
    const useCase = new DeleteExpense(expenses);
    const id = ExpenseId.generate();
    const categoryId = CategoryId.generate();
    await expenses.save(makeExpense(id, categoryId));

    await useCase.execute({ id });

    const found = await expenses.findById(id);
    expect(found).toBeNull();
  });

  it('throws when the expense does not exist', async () => {
    const useCase = new DeleteExpense(expenses);

    await expect(useCase.execute({ id: ExpenseId.generate() })).rejects.toThrow(ApplicationError);
  });
});

describe('Expense / ListExpenses', () => {
  let expenses: InMemoryExpenseRepository;
  let categories: InMemoryCategoryRepository;
  const pagination = new Pagination(10, 0);

  beforeEach(() => {
    expenses = new InMemoryExpenseRepository();
    categories = new InMemoryCategoryRepository();
  });

  it('returns a paginated page of expenses for the household', async () => {
    const useCase = new ListExpenses(expenses, categories);
    const categoryId = CategoryId.generate();
    await expenses.save(makeExpense(ExpenseId.generate(), categoryId));
    await expenses.save(makeExpense(ExpenseId.generate(), categoryId));

    const result = await useCase.execute({
      householdId,
      filters: new ExpenseFilters(),
      pagination,
    });

    expect(result.page.items).toHaveLength(2);
    expect(result.page.total).toBe(2);
  });

  it('filters expenses by category id', async () => {
    const useCase = new ListExpenses(expenses, categories);
    const catA = CategoryId.generate();
    const catB = CategoryId.generate();
    await expenses.save(makeExpense(ExpenseId.generate(), catA));
    await expenses.save(makeExpense(ExpenseId.generate(), catB));

    const result = await useCase.execute({
      householdId,
      filters: new ExpenseFilters(undefined, undefined, [catA]),
      pagination,
    });

    expect(result.page.items).toHaveLength(1);
    expect(result.page.items[0].categoryId).toBe(catA);
  });

  it('filters expenses by date range', async () => {
    const useCase = new ListExpenses(expenses, categories);
    const categoryId = CategoryId.generate();
    const jan = new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'Cash' }, new ExpenseDate(new Date('2024-01-10')));
    const mar = new Expense(ExpenseId.generate(), householdId, userId, categoryId, money, { kind: 'Cash' }, new ExpenseDate(new Date('2024-03-10')));
    await expenses.save(jan);
    await expenses.save(mar);

    const result = await useCase.execute({
      householdId,
      filters: new ExpenseFilters(
        new ExpenseDate(new Date('2024-02-01')),
        new ExpenseDate(new Date('2024-04-01')),
      ),
      pagination,
    });

    expect(result.page.items).toHaveLength(1);
    expect(result.page.items[0].date.toDate().getMonth()).toBe(2); // March
  });

  it('throws when both groupId and filters.categoryIds are provided', async () => {
    const useCase = new ListExpenses(expenses, categories);
    const categoryId = CategoryId.generate();

    await expect(
      useCase.execute({
        householdId,
        filters: new ExpenseFilters(undefined, undefined, [categoryId]),
        groupId,
        pagination,
      }),
    ).rejects.toThrow(ApplicationError);
  });

  it('resolves a groupId filter to its category ids and returns only matching expenses', async () => {
    const useCase = new ListExpenses(expenses, categories);
    const catInGroup = CategoryId.generate();
    const catOther = CategoryId.generate();
    await categories.save(new Category(catInGroup, householdId, groupId, 'InGroup'));
    await expenses.save(makeExpense(ExpenseId.generate(), catInGroup));
    await expenses.save(makeExpense(ExpenseId.generate(), catOther));

    const result = await useCase.execute({
      householdId,
      filters: new ExpenseFilters(),
      groupId,
      pagination,
    });

    expect(result.page.items).toHaveLength(1);
    expect(result.page.items[0].categoryId).toBe(catInGroup);
  });
});
