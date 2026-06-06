import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../../src/http/app.js';
import { makeRepos } from '../helpers/repositories.js';
import { clearTables } from '../helpers/testDb.js';

beforeEach(clearTables);

function makeApp() {
  return buildApp(makeRepos());
}

describe('POST /api/users', () => {
  it('creates a user and the id is usable in a subsequent POST /api/households', async () => {
    const app = makeApp();

    const createUser = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'Alice' },
    });
    expect(createUser.statusCode).toBe(201);
    const { id: userId } = createUser.json<{ id: string }>();

    const createHousehold = await app.inject({
      method: 'POST',
      url: '/api/households',
      headers: { 'x-user-id': userId },
      payload: { name: 'Home' },
    });
    expect(createHousehold.statusCode).toBe(201);
  });
});

describe('POST /api/households', () => {
  it('creates a household and a second user can join it', async () => {
    const app = makeApp();

    const userA = await app.inject({ method: 'POST', url: '/api/users', payload: { name: 'Alice' } });
    const { id: userAId } = userA.json<{ id: string }>();

    const createHousehold = await app.inject({
      method: 'POST',
      url: '/api/households',
      headers: { 'x-user-id': userAId },
      payload: { name: 'Home' },
    });
    expect(createHousehold.statusCode).toBe(201);
    const { id: householdId } = createHousehold.json<{ id: string }>();

    const userB = await app.inject({ method: 'POST', url: '/api/users', payload: { name: 'Bob' } });
    const { id: userBId } = userB.json<{ id: string }>();

    const join = await app.inject({
      method: 'POST',
      url: `/api/households/${householdId}/members`,
      headers: { 'x-user-id': userBId },
    });
    expect(join.statusCode).toBe(204);
  });
});

describe('POST /api/households/:id/members', () => {
  it('joins a household and a second join attempt returns 422', async () => {
    const app = makeApp();

    const userA = await app.inject({ method: 'POST', url: '/api/users', payload: { name: 'Alice' } });
    const { id: userAId } = userA.json<{ id: string }>();

    const createHousehold = await app.inject({
      method: 'POST',
      url: '/api/households',
      headers: { 'x-user-id': userAId },
      payload: { name: 'Home' },
    });
    const { id: householdId } = createHousehold.json<{ id: string }>();

    const userB = await app.inject({ method: 'POST', url: '/api/users', payload: { name: 'Bob' } });
    const { id: userBId } = userB.json<{ id: string }>();

    const firstJoin = await app.inject({
      method: 'POST',
      url: `/api/households/${householdId}/members`,
      headers: { 'x-user-id': userBId },
    });
    expect(firstJoin.statusCode).toBe(204);

    const secondJoin = await app.inject({
      method: 'POST',
      url: `/api/households/${householdId}/members`,
      headers: { 'x-user-id': userBId },
    });
    expect(secondJoin.statusCode).toBe(422);
  });
});
