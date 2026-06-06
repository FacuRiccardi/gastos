import { describe, it, expect } from 'vitest';
import { buildApp } from '../../../src/http/app.js';
import { InMemoryHouseholdRepository } from '../../helpers/InMemoryHouseholdRepository.js';
import { InMemoryUserRepository } from '../../helpers/InMemoryUserRepository.js';
import { InMemoryGroupRepository } from '../../helpers/InMemoryGroupRepository.js';
import { InMemoryCategoryRepository } from '../../helpers/InMemoryCategoryRepository.js';
import { InMemoryExpenseRepository } from '../../helpers/InMemoryExpenseRepository.js';
import { InMemoryPaymentInstrumentRepository } from '../../helpers/InMemoryPaymentInstrumentRepository.js';
import { InMemoryBudgetLimitRepository } from '../../helpers/InMemoryBudgetLimitRepository.js';
import { UserId } from '../../../src/domain/identity/user/UserId.js';
import { HouseholdId } from '../../../src/domain/identity/household/HouseholdId.js';
import { User } from '../../../src/domain/identity/user/User.js';
import { Household } from '../../../src/domain/identity/household/Household.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function makeApp() {
  return buildApp({
    households: new InMemoryHouseholdRepository(),
    users: new InMemoryUserRepository(),
    groups: new InMemoryGroupRepository(),
    categories: new InMemoryCategoryRepository(),
    expenses: new InMemoryExpenseRepository(),
    paymentInstruments: new InMemoryPaymentInstrumentRepository(),
    budgetLimits: new InMemoryBudgetLimitRepository(),
  });
}

describe('POST /api/users', () => {
  it('returns 201 with { id: string } for valid { name } body', async () => {
    const app = makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'Alice' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<{ id: string }>();
    expect(body.id).toMatch(UUID_RE);
  });

  it('returns 400 when name is missing from body', async () => {
    const app = makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /api/households', () => {
  it('returns 201 with { id: string } for valid body + X-User-Id header', async () => {
    const users = new InMemoryUserRepository();
    const userId = UserId.generate();
    await users.save(new User(userId, 'Alice'));
    const app = buildApp({
      households: new InMemoryHouseholdRepository(),
      users,
      groups: new InMemoryGroupRepository(),
      categories: new InMemoryCategoryRepository(),
      expenses: new InMemoryExpenseRepository(),
      paymentInstruments: new InMemoryPaymentInstrumentRepository(),
      budgetLimits: new InMemoryBudgetLimitRepository(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/households',
      headers: { 'x-user-id': userId },
      payload: { name: 'Home' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ id: string }>().id).toMatch(UUID_RE);
  });

  it('returns 400 when X-User-Id header is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/households',
      payload: { name: 'Home' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when X-User-Id is not a valid UUID', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/households',
      headers: { 'x-user-id': 'not-a-uuid' },
      payload: { name: 'Home' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when name is missing from body', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/households',
      headers: { 'x-user-id': UserId.generate() },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when user does not exist', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/households',
      headers: { 'x-user-id': UserId.generate() },
      payload: { name: 'Home' },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('POST /api/households/:id/members', () => {
  it('returns 204 when user and household both exist', async () => {
    const users = new InMemoryUserRepository();
    const households = new InMemoryHouseholdRepository();
    const creatorId = UserId.generate();
    const joiningUserId = UserId.generate();
    const householdId = HouseholdId.generate();
    await users.save(new User(creatorId, 'Alice'));
    await users.save(new User(joiningUserId, 'Bob'));
    await households.save(new Household(householdId, 'Home', [creatorId]));
    const app = buildApp({
      households,
      users,
      groups: new InMemoryGroupRepository(),
      categories: new InMemoryCategoryRepository(),
      expenses: new InMemoryExpenseRepository(),
      paymentInstruments: new InMemoryPaymentInstrumentRepository(),
      budgetLimits: new InMemoryBudgetLimitRepository(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/households/${householdId}/members`,
      headers: { 'x-user-id': joiningUserId },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when X-User-Id header is missing', async () => {
    const householdId = HouseholdId.generate();
    const response = await makeApp().inject({
      method: 'POST',
      url: `/api/households/${householdId}/members`,
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when household is not found', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: `/api/households/${HouseholdId.generate()}/members`,
      headers: { 'x-user-id': UserId.generate() },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 422 when user is already a member', async () => {
    const users = new InMemoryUserRepository();
    const households = new InMemoryHouseholdRepository();
    const userId = UserId.generate();
    const householdId = HouseholdId.generate();
    await users.save(new User(userId, 'Alice'));
    await households.save(new Household(householdId, 'Home', [userId]));
    const app = buildApp({
      households,
      users,
      groups: new InMemoryGroupRepository(),
      categories: new InMemoryCategoryRepository(),
      expenses: new InMemoryExpenseRepository(),
      paymentInstruments: new InMemoryPaymentInstrumentRepository(),
      budgetLimits: new InMemoryBudgetLimitRepository(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/households/${householdId}/members`,
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(422);
  });
});
