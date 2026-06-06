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
import { BudgetLimitId } from '../../../src/domain/budget/BudgetLimitId.js';
import { BudgetLimit } from '../../../src/domain/budget/BudgetLimit.js';
import { BudgetPeriod } from '../../../src/domain/budget/BudgetPeriod.js';
import { Money } from '../../../src/domain/shared/Money.js';
import { Currency } from '../../../src/domain/shared/Currency.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const householdId = HouseholdId.generate();
const userId = UserId.generate();

function makeApp(budgetLimits = new InMemoryBudgetLimitRepository()) {
  return buildApp({
    households: new InMemoryHouseholdRepository(),
    users: new InMemoryUserRepository(),
    groups: new InMemoryGroupRepository(),
    categories: new InMemoryCategoryRepository(),
    expenses: new InMemoryExpenseRepository(),
    paymentInstruments: new InMemoryPaymentInstrumentRepository(),
    budgetLimits,
  });
}

const monthlyPeriod = { kind: 'Monthly' };
const validMoney = { amount: 5000, currency: 'ARS' };
const categoryId = CategoryId.generate();

// ─── POST /api/budget-limits ──────────────────────────────────────────────────

describe('POST /api/budget-limits', () => {
  it('returns 201 with { id: string } for a valid category-based limit', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: validMoney, period: monthlyPeriod, categoryId },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ id: string }>().id).toMatch(UUID_RE);
  });

  it('returns 400 when X-Household-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId },
      payload: { money: validMoney, period: monthlyPeriod, categoryId },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when money or period is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: validMoney, categoryId },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when neither categoryId nor groupId is provided', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: validMoney, period: monthlyPeriod },
    });
    expect(response.statusCode).toBe(400);
  });
});

// ─── PATCH /api/budget-limits/:id ────────────────────────────────────────────

describe('PATCH /api/budget-limits/:id', () => {
  it('returns 204 for valid request', async () => {
    const limits = new InMemoryBudgetLimitRepository();
    const limitId = BudgetLimitId.generate();
    await limits.save(BudgetLimit.forCategory(limitId, householdId, new Money(1000, Currency.ARS), BudgetPeriod.monthly(), categoryId));
    const response = await makeApp(limits).inject({
      method: 'PATCH',
      url: `/api/budget-limits/${limitId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 2000, currency: 'ARS' }, period: { kind: 'Monthly' } },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when money or period is missing', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/budget-limits/${BudgetLimitId.generate()}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 2000, currency: 'ARS' } },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when budget limit is not found', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/budget-limits/${BudgetLimitId.generate()}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 2000, currency: 'ARS' }, period: { kind: 'Monthly' } },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when budget limit belongs to a different household', async () => {
    const limits = new InMemoryBudgetLimitRepository();
    const limitId = BudgetLimitId.generate();
    const otherHouseholdId = HouseholdId.generate();
    await limits.save(BudgetLimit.forCategory(limitId, otherHouseholdId, new Money(500, Currency.ARS), BudgetPeriod.monthly(), CategoryId.generate()));
    const response = await makeApp(limits).inject({
      method: 'PATCH',
      url: `/api/budget-limits/${limitId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: validMoney, period: monthlyPeriod },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── DELETE /api/budget-limits/:id ───────────────────────────────────────────

describe('DELETE /api/budget-limits/:id', () => {
  it('returns 204 for valid request', async () => {
    const limits = new InMemoryBudgetLimitRepository();
    const limitId = BudgetLimitId.generate();
    await limits.save(BudgetLimit.forCategory(limitId, householdId, new Money(1000, Currency.ARS), BudgetPeriod.monthly(), categoryId));
    const response = await makeApp(limits).inject({
      method: 'DELETE',
      url: `/api/budget-limits/${limitId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when X-User-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: `/api/budget-limits/${BudgetLimitId.generate()}`,
      headers: { 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when budget limit is not found', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: `/api/budget-limits/${BudgetLimitId.generate()}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when budget limit belongs to a different household', async () => {
    const limits = new InMemoryBudgetLimitRepository();
    const limitId = BudgetLimitId.generate();
    const otherHouseholdId = HouseholdId.generate();
    await limits.save(BudgetLimit.forCategory(limitId, otherHouseholdId, new Money(500, Currency.ARS), BudgetPeriod.monthly(), CategoryId.generate()));
    const response = await makeApp(limits).inject({
      method: 'DELETE',
      url: `/api/budget-limits/${limitId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /api/budget-limits/:id/balance ──────────────────────────────────────

describe('GET /api/budget-limits/:id/balance', () => {
  it('returns 200 with { remaining: { amount, currency } }', async () => {
    const limits = new InMemoryBudgetLimitRepository();
    const limitId = BudgetLimitId.generate();
    await limits.save(BudgetLimit.forCategory(limitId, householdId, new Money(5000, Currency.ARS), BudgetPeriod.monthly(), categoryId));
    const response = await makeApp(limits).inject({
      method: 'GET',
      url: `/api/budget-limits/${limitId}/balance`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ remaining: { amount: number; currency: string } }>();
    expect(typeof body.remaining.amount).toBe('number');
    expect(body.remaining.currency).toBe('ARS');
  });

  it('returns 404 when budget limit is not found', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: `/api/budget-limits/${BudgetLimitId.generate()}/balance`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when budget limit belongs to a different household', async () => {
    const limits = new InMemoryBudgetLimitRepository();
    const limitId = BudgetLimitId.generate();
    const otherHouseholdId = HouseholdId.generate();
    await limits.save(BudgetLimit.forCategory(limitId, otherHouseholdId, new Money(500, Currency.ARS), BudgetPeriod.monthly(), CategoryId.generate()));
    const response = await makeApp(limits).inject({
      method: 'GET',
      url: `/api/budget-limits/${limitId}/balance`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /api/budget-limits ───────────────────────────────────────────────────

describe('GET /api/budget-limits', () => {
  it('returns 200 with { limits: Array<{ id, money, period, categoryId? }> }', async () => {
    const budgetLimits = new InMemoryBudgetLimitRepository();
    const limitId = BudgetLimitId.generate();
    await budgetLimits.save(BudgetLimit.forCategory(limitId, householdId, new Money(3000, Currency.ARS), BudgetPeriod.monthly(), categoryId));
    const response = await makeApp(budgetLimits).inject({
      method: 'GET',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ limits: Array<{ id: string; money: { amount: number; currency: string }; period: { kind: string }; categoryId?: string }> }>();
    expect(body.limits).toHaveLength(1);
    expect(body.limits[0]).toMatchObject({
      id: limitId,
      money: { amount: 3000, currency: 'ARS' },
      period: { kind: 'Monthly' },
      categoryId,
    });
  });

  it('returns 400 when X-Household-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(400);
  });
});
