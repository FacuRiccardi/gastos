import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../../src/http/app.js';
import { makeRepos } from '../helpers/repositories.js';
import { clearTables } from '../helpers/testDb.js';

beforeEach(clearTables);

function makeApp() {
  return buildApp(makeRepos());
}

async function seedHousehold(app: ReturnType<typeof makeApp>) {
  const user = await app.inject({ method: 'POST', url: '/api/users', payload: { name: 'Alice' } });
  const { id: userId } = user.json<{ id: string }>();
  const household = await app.inject({
    method: 'POST',
    url: '/api/households',
    headers: { 'x-user-id': userId },
    payload: { name: 'Home' },
  });
  const { id: householdId } = household.json<{ id: string }>();
  return { userId, householdId };
}

async function seedCategory(app: ReturnType<typeof makeApp>, userId: string, householdId: string) {
  const group = await app.inject({
    method: 'POST',
    url: '/api/groups',
    headers: { 'x-user-id': userId, 'x-household-id': householdId },
    payload: { name: 'Variable' },
  });
  const { id: groupId } = group.json<{ id: string }>();
  const category = await app.inject({
    method: 'POST',
    url: '/api/categories',
    headers: { 'x-user-id': userId, 'x-household-id': householdId },
    payload: { name: 'Food', groupId },
  });
  const { id: categoryId } = category.json<{ id: string }>();
  return { groupId, categoryId };
}

describe('POST /api/budget-limits', () => {
  it('creates a budget limit and GET /api/budget-limits returns it', async () => {
    const app = makeApp();
    const { userId, householdId } = await seedHousehold(app);
    const { categoryId } = await seedCategory(app, userId, householdId);

    const create = await app.inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 5000, currency: 'ARS' }, period: { kind: 'Monthly' }, categoryId },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: 'GET',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(list.statusCode).toBe(200);
    const { limits } = list.json<{ limits: Array<{ money: { amount: number } }> }>();
    expect(limits.some((l) => l.money.amount === 5000)).toBe(true);
  });
});

describe('PATCH /api/budget-limits/:id', () => {
  it('edits a budget limit and GET /api/budget-limits/:id/balance reflects the new cap', async () => {
    const app = makeApp();
    const { userId, householdId } = await seedHousehold(app);
    const { categoryId } = await seedCategory(app, userId, householdId);

    const create = await app.inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 1000, currency: 'ARS' }, period: { kind: 'Monthly' }, categoryId },
    });
    const { id: limitId } = create.json<{ id: string }>();

    const edit = await app.inject({
      method: 'PATCH',
      url: `/api/budget-limits/${limitId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 8000, currency: 'ARS' }, period: { kind: 'Monthly' } },
    });
    expect(edit.statusCode).toBe(204);

    const balance = await app.inject({
      method: 'GET',
      url: `/api/budget-limits/${limitId}/balance`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    const { remaining } = balance.json<{ remaining: { amount: number } }>();
    expect(remaining.amount).toBe(8000);
  });
});

describe('DELETE /api/budget-limits/:id', () => {
  it('deletes a budget limit and GET /api/budget-limits no longer includes it', async () => {
    const app = makeApp();
    const { userId, householdId } = await seedHousehold(app);
    const { categoryId } = await seedCategory(app, userId, householdId);

    const create = await app.inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 2000, currency: 'ARS' }, period: { kind: 'Monthly' }, categoryId },
    });
    const { id: limitId } = create.json<{ id: string }>();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/budget-limits/${limitId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    const { limits } = list.json<{ limits: Array<{ id: string }> }>();
    expect(limits.some((l) => l.id === limitId)).toBe(false);
  });
});

describe('GET /api/budget-limits/:id/balance', () => {
  it('logs expenses then GET balance returns the correct remaining amount', async () => {
    const app = makeApp();
    const { userId, householdId } = await seedHousehold(app);
    const { categoryId } = await seedCategory(app, userId, householdId);

    const create = await app.inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 5000, currency: 'ARS' }, period: { kind: 'Monthly' }, categoryId },
    });
    const { id: limitId } = create.json<{ id: string }>();

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;

    await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { categoryId, money: { amount: 1500, currency: 'ARS' }, paymentMethod: { kind: 'Cash' }, date: thisMonth },
    });

    const balance = await app.inject({
      method: 'GET',
      url: `/api/budget-limits/${limitId}/balance`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(balance.statusCode).toBe(200);
    const { remaining } = balance.json<{ remaining: { amount: number; currency: string } }>();
    expect(remaining.amount).toBe(3500);
    expect(remaining.currency).toBe('ARS');
  });
});

describe('GET /api/budget-limits', () => {
  it('seeds budget limits and returns them', async () => {
    const app = makeApp();
    const { userId, householdId } = await seedHousehold(app);
    const { categoryId } = await seedCategory(app, userId, householdId);

    await app.inject({
      method: 'POST',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { money: { amount: 3000, currency: 'ARS' }, period: { kind: 'Monthly' }, categoryId },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/budget-limits',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(list.statusCode).toBe(200);
    const { limits } = list.json<{ limits: Array<{ money: { amount: number }; period: { kind: string } }> }>();
    expect(limits).toHaveLength(1);
    expect(limits[0]!.money.amount).toBe(3000);
    expect(limits[0]!.period.kind).toBe('Monthly');
  });
});
