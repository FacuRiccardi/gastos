import { describe, it, expect } from 'vitest';
import { buildApp } from '../../../src/http/app.js';
import { InMemoryHouseholdRepository } from '../../helpers/InMemoryHouseholdRepository.js';
import { InMemoryUserRepository } from '../../helpers/InMemoryUserRepository.js';
import { InMemoryGroupRepository } from '../../helpers/InMemoryGroupRepository.js';
import { InMemoryCategoryRepository } from '../../helpers/InMemoryCategoryRepository.js';
import { InMemoryExpenseRepository } from '../../helpers/InMemoryExpenseRepository.js';
import { InMemoryPaymentInstrumentRepository } from '../../helpers/InMemoryPaymentInstrumentRepository.js';
import { InMemoryBudgetLimitRepository } from '../../helpers/InMemoryBudgetLimitRepository.js';
import { HouseholdId } from '../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../src/domain/identity/user/UserId.js';
import { CategoryId } from '../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../src/domain/catalogue/group/GroupId.js';
import { ExpenseId } from '../../../src/domain/expense/ExpenseId.js';
import { PaymentInstrumentId } from '../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { Category } from '../../../src/domain/catalogue/category/Category.js';
import { Expense } from '../../../src/domain/expense/Expense.js';
import { ExpenseDate } from '../../../src/domain/expense/ExpenseDate.js';
import { Money } from '../../../src/domain/shared/Money.js';
import { Currency } from '../../../src/domain/shared/Currency.js';
import { PaymentInstrument } from '../../../src/domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentType } from '../../../src/domain/expense/payment-instrument/PaymentInstrumentType.js';
import { ExpenseFilters } from '../../../src/domain/expense/ExpenseFilters.js';
import { Pagination } from '../../../src/domain/shared/Pagination.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const householdId = HouseholdId.generate();
const userId = UserId.generate();

function makeApp(
  expenses = new InMemoryExpenseRepository(),
  categories = new InMemoryCategoryRepository(),
  paymentInstruments = new InMemoryPaymentInstrumentRepository(),
) {
  return buildApp({
    households: new InMemoryHouseholdRepository(),
    users: new InMemoryUserRepository(),
    groups: new InMemoryGroupRepository(),
    categories,
    expenses,
    paymentInstruments,
    budgetLimits: new InMemoryBudgetLimitRepository(),
  });
}

// ─── POST /api/expenses ───────────────────────────────────────────────────────

describe('POST /api/expenses', () => {
  it('returns 201 with { id: string } for a valid cash expense', async () => {
    const categories = new InMemoryCategoryRepository();
    const categoryId = CategoryId.generate();
    await categories.save(new Category(categoryId, householdId, GroupId.generate(), 'Food'));
    const response = await makeApp(undefined, categories).inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {
        categoryId,
        money: { amount: 100, currency: 'ARS' },
        paymentMethod: { kind: 'Cash' },
        date: '2024-06-01',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ id: string }>().id).toMatch(UUID_RE);
  });

  it('returns 400 when X-User-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-household-id': householdId },
      payload: { categoryId: CategoryId.generate(), money: { amount: 100, currency: 'ARS' }, paymentMethod: { kind: 'Cash' }, date: '2024-06-01' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when X-Household-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId },
      payload: { categoryId: CategoryId.generate(), money: { amount: 100, currency: 'ARS' }, paymentMethod: { kind: 'Cash' }, date: '2024-06-01' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { categoryId: CategoryId.generate() },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when date is not in YYYY-MM-DD format', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {
        categoryId: CategoryId.generate(),
        money: { amount: 100, currency: 'ARS' },
        paymentMethod: { kind: 'Cash' },
        date: 'not-a-date',
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('stores the date as the local calendar date (no UTC timezone shift)', async () => {
    const expenses = new InMemoryExpenseRepository();
    const categories = new InMemoryCategoryRepository();
    const categoryId = CategoryId.generate();
    await categories.save(new Category(categoryId, householdId, GroupId.generate(), 'Food'));

    await makeApp(expenses, categories).inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {
        categoryId,
        money: { amount: 100, currency: 'ARS' },
        paymentMethod: { kind: 'Cash' },
        date: '2026-06-01',
      },
    });

    const page = await expenses.findByHousehold(householdId, new ExpenseFilters(), new Pagination(10, 0));
    const dt = page.items[0].date.toDate();
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(5);
    expect(dt.getDate()).toBe(1);
  });

  it('returns 404 when category is not found', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {
        categoryId: CategoryId.generate(),
        money: { amount: 100, currency: 'ARS' },
        paymentMethod: { kind: 'Cash' },
        date: '2024-06-01',
      },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── DELETE /api/expenses/:id ─────────────────────────────────────────────────

describe('DELETE /api/expenses/:id', () => {
  it('returns 204 for valid request', async () => {
    const expenses = new InMemoryExpenseRepository();
    const expenseId = ExpenseId.generate();
    const categoryId = CategoryId.generate();
    await expenses.save(new Expense(
      expenseId, householdId, userId, categoryId,
      new Money(100, Currency.ARS), { kind: 'Cash' },
      new ExpenseDate(new Date('2024-06-01')),
    ));
    const response = await makeApp(expenses).inject({
      method: 'DELETE',
      url: `/api/expenses/${expenseId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when X-User-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: `/api/expenses/${ExpenseId.generate()}`,
      headers: { 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when expense is not found', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: `/api/expenses/${ExpenseId.generate()}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when expense belongs to a different household', async () => {
    const expenses = new InMemoryExpenseRepository();
    const expenseId = ExpenseId.generate();
    const categoryId = CategoryId.generate();
    const otherHouseholdId = HouseholdId.generate();
    await expenses.save(new Expense(
      expenseId, otherHouseholdId, userId, categoryId,
      new Money(100, Currency.ARS), { kind: 'Cash' },
      new ExpenseDate(new Date('2024-06-01')),
    ));
    const response = await makeApp(expenses).inject({
      method: 'DELETE',
      url: `/api/expenses/${expenseId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /api/expenses ────────────────────────────────────────────────────────

describe('GET /api/expenses', () => {
  it('returns 200 with paginated { items, total } shape', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ items: unknown[]; total: number }>();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  it('returns 400 when X-Household-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/expenses',
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when limit is not a valid integer', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/expenses?limit=abc',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 200 when filtering by a single categoryId string', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: `/api/expenses?categoryId=${CategoryId.generate()}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(200);
  });

  it('returns 400 when from is not in YYYY-MM-DD format', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/expenses?from=not-a-date',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /api/payment-instruments ───────────────────────────────────────────

describe('POST /api/payment-instruments', () => {
  it('returns 201 with { id: string } for valid body + X-User-Id', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
      payload: { type: 'CreditCard', name: 'Visa Platinum' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ id: string }>().id).toMatch(UUID_RE);
  });

  it('returns 400 when X-User-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/payment-instruments',
      payload: { type: 'CreditCard', name: 'Visa Platinum' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when type or name is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
      payload: { name: 'Visa Platinum' },
    });
    expect(response.statusCode).toBe(400);
  });
});

// ─── PATCH /api/payment-instruments/:id/name ─────────────────────────────────

describe('PATCH /api/payment-instruments/:id/name', () => {
  it('returns 204 for valid request', async () => {
    const instruments = new InMemoryPaymentInstrumentRepository();
    const instrumentId = PaymentInstrumentId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, userId, PaymentInstrumentType.CreditCard, 'Old Name'));
    const response = await makeApp(undefined, undefined, instruments).inject({
      method: 'PATCH',
      url: `/api/payment-instruments/${instrumentId}/name`,
      headers: { 'x-user-id': userId },
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when name is missing from body', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/payment-instruments/${PaymentInstrumentId.generate()}/name`,
      headers: { 'x-user-id': userId },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when instrument is not found', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/payment-instruments/${PaymentInstrumentId.generate()}/name`,
      headers: { 'x-user-id': userId },
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when instrument belongs to a different user', async () => {
    const instruments = new InMemoryPaymentInstrumentRepository();
    const instrumentId = PaymentInstrumentId.generate();
    const otherUserId = UserId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, otherUserId, PaymentInstrumentType.CreditCard, 'Other Card'));
    const response = await makeApp(undefined, undefined, instruments).inject({
      method: 'PATCH',
      url: `/api/payment-instruments/${instrumentId}/name`,
      headers: { 'x-user-id': userId },
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── DELETE /api/payment-instruments/:id ─────────────────────────────────────

describe('DELETE /api/payment-instruments/:id', () => {
  it('returns 204 for valid request', async () => {
    const instruments = new InMemoryPaymentInstrumentRepository();
    const instrumentId = PaymentInstrumentId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, userId, PaymentInstrumentType.BankAccount, 'Savings'));
    const response = await makeApp(undefined, undefined, instruments).inject({
      method: 'DELETE',
      url: `/api/payment-instruments/${instrumentId}`,
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 404 when instrument is not found', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: `/api/payment-instruments/${PaymentInstrumentId.generate()}`,
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 422 when instrument is already deleted', async () => {
    const instruments = new InMemoryPaymentInstrumentRepository();
    const instrumentId = PaymentInstrumentId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, userId, PaymentInstrumentType.CreditCard, 'Card', new Date()));
    const response = await makeApp(undefined, undefined, instruments).inject({
      method: 'DELETE',
      url: `/api/payment-instruments/${instrumentId}`,
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(422);
  });

  it('returns 404 when instrument belongs to a different user', async () => {
    const instruments = new InMemoryPaymentInstrumentRepository();
    const instrumentId = PaymentInstrumentId.generate();
    const otherUserId = UserId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, otherUserId, PaymentInstrumentType.BankAccount, 'Other Savings'));
    const response = await makeApp(undefined, undefined, instruments).inject({
      method: 'DELETE',
      url: `/api/payment-instruments/${instrumentId}`,
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /api/payment-instruments ────────────────────────────────────────────

describe('GET /api/payment-instruments', () => {
  it('returns 200 with { instruments: Array<{ id, userId, type, name }> }', async () => {
    const instruments = new InMemoryPaymentInstrumentRepository();
    const instrumentId = PaymentInstrumentId.generate();
    await instruments.save(new PaymentInstrument(instrumentId, userId, PaymentInstrumentType.CreditCard, 'Visa'));
    const response = await makeApp(undefined, undefined, instruments).inject({
      method: 'GET',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ instruments: Array<{ id: string; userId: string; type: string; name: string }> }>();
    expect(body.instruments).toHaveLength(1);
    expect(body.instruments[0]).toMatchObject({ id: instrumentId, userId, type: 'CreditCard', name: 'Visa' });
  });

  it('returns 400 when X-User-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/payment-instruments',
    });
    expect(response.statusCode).toBe(400);
  });
});
