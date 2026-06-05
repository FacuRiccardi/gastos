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

describe('POST /api/expenses', () => {
  it('logs an expense and GET /api/expenses returns it in the list', async () => {
    const app = makeApp();
    const { userId, householdId } = await seedHousehold(app);
    const { categoryId } = await seedCategory(app, userId, householdId);

    const create = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {
        categoryId,
        money: { amount: 150, currency: 'ARS' },
        paymentMethod: { kind: 'Cash' },
        date: '2024-06-01',
      },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(list.statusCode).toBe(200);
    const { items } = list.json<{ items: Array<{ money: { amount: number } }> }>();
    expect(items.some((e) => e.money.amount === 150)).toBe(true);
  });
});

describe('DELETE /api/expenses/:id', () => {
  it('logs then deletes an expense; GET /api/expenses no longer returns it', async () => {
    const app = makeApp();
    const { userId, householdId } = await seedHousehold(app);
    const { categoryId } = await seedCategory(app, userId, householdId);

    const create = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {
        categoryId,
        money: { amount: 200, currency: 'ARS' },
        paymentMethod: { kind: 'Cash' },
        date: '2024-06-01',
      },
    });
    const { id: expenseId } = create.json<{ id: string }>();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/expenses/${expenseId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    const { items } = list.json<{ items: Array<{ id: string }> }>();
    expect(items.some((e) => e.id === expenseId)).toBe(false);
  });
});

describe('GET /api/expenses', () => {
  it('seeds expenses and returns them with correct total', async () => {
    const app = makeApp();
    const { userId, householdId } = await seedHousehold(app);
    const { categoryId } = await seedCategory(app, userId, householdId);

    await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { categoryId, money: { amount: 50, currency: 'ARS' }, paymentMethod: { kind: 'Cash' }, date: '2024-06-01' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(list.statusCode).toBe(200);
    const { items, total } = list.json<{ items: unknown[]; total: number }>();
    expect(items).toHaveLength(1);
    expect(total).toBe(1);
  });
});

describe('POST /api/payment-instruments', () => {
  it('creates a payment instrument and GET /api/payment-instruments returns it', async () => {
    const app = makeApp();
    const { userId } = await seedHousehold(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
      payload: { type: 'CreditCard', name: 'Visa Platinum' },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: 'GET',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
    });
    expect(list.statusCode).toBe(200);
    const { instruments } = list.json<{ instruments: Array<{ name: string }> }>();
    expect(instruments.some((i) => i.name === 'Visa Platinum')).toBe(true);
  });
});

describe('PATCH /api/payment-instruments/:id/name', () => {
  it('renames an instrument and GET /api/payment-instruments shows the new name', async () => {
    const app = makeApp();
    const { userId } = await seedHousehold(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
      payload: { type: 'CreditCard', name: 'Old Name' },
    });
    const { id: instrumentId } = create.json<{ id: string }>();

    await app.inject({
      method: 'PATCH',
      url: `/api/payment-instruments/${instrumentId}/name`,
      headers: { 'x-user-id': userId },
      payload: { name: 'New Name' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
    });
    const { instruments } = list.json<{ instruments: Array<{ name: string }> }>();
    expect(instruments.some((i) => i.name === 'New Name')).toBe(true);
    expect(instruments.some((i) => i.name === 'Old Name')).toBe(false);
  });
});

describe('DELETE /api/payment-instruments/:id', () => {
  it('soft-deletes an instrument and GET /api/payment-instruments no longer returns it', async () => {
    const app = makeApp();
    const { userId } = await seedHousehold(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
      payload: { type: 'BankAccount', name: 'Checking' },
    });
    const { id: instrumentId } = create.json<{ id: string }>();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/payment-instruments/${instrumentId}`,
      headers: { 'x-user-id': userId },
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
    });
    const { instruments } = list.json<{ instruments: Array<{ name: string }> }>();
    expect(instruments.some((i) => i.name === 'Checking')).toBe(false);
  });
});

describe('GET /api/payment-instruments', () => {
  it('seeds instruments and returns them', async () => {
    const app = makeApp();
    const { userId } = await seedHousehold(app);

    await app.inject({
      method: 'POST',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
      payload: { type: 'CreditCard', name: 'Amex' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/payment-instruments',
      headers: { 'x-user-id': userId },
    });
    expect(list.statusCode).toBe(200);
    const { instruments } = list.json<{ instruments: Array<{ id: string; type: string; name: string }> }>();
    expect(instruments).toHaveLength(1);
    expect(instruments[0]!.name).toBe('Amex');
    expect(instruments[0]!.type).toBe('CreditCard');
  });
});
