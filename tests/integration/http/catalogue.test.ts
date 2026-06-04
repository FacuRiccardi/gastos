import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../../src/http/app.js';
import { makeRepos } from '../helpers/repositories.js';
import { clearTables } from '../helpers/testDb.js';

beforeEach(clearTables);

function makeApp() {
  return buildApp(makeRepos());
}

async function seed(app: ReturnType<typeof makeApp>) {
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

describe('POST /api/groups', () => {
  it('creates a group and GET /api/groups returns it in the list', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Fixed Expenses' },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: 'GET',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(list.statusCode).toBe(200);
    const { groups } = list.json<{ groups: Array<{ name: string }> }>();
    expect(groups.some((g) => g.name === 'Fixed Expenses')).toBe(true);
  });
});

describe('PATCH /api/groups/:id/name', () => {
  it('renames a group and GET /api/groups shows the updated name', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Old Name' },
    });
    const { id: groupId } = create.json<{ id: string }>();

    await app.inject({
      method: 'PATCH',
      url: `/api/groups/${groupId}/name`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'New Name' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    const { groups } = list.json<{ groups: Array<{ name: string }> }>();
    expect(groups.some((g) => g.name === 'New Name')).toBe(true);
    expect(groups.some((g) => g.name === 'Old Name')).toBe(false);
  });
});

describe('DELETE /api/groups/:id', () => {
  it('soft-deletes a group and GET /api/groups no longer returns it', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Groceries' },
    });
    const { id: groupId } = create.json<{ id: string }>();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/groups/${groupId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    const { groups } = list.json<{ groups: Array<{ name: string }> }>();
    expect(groups.some((g) => g.name === 'Groceries')).toBe(false);
  });
});

describe('GET /api/groups', () => {
  it('seeds groups and returns them in the list', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Transport' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(list.statusCode).toBe(200);
    const { groups } = list.json<{ groups: Array<{ id: string; name: string }> }>();
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe('Transport');
  });
});

describe('POST /api/categories', () => {
  it('creates a category and GET /api/categories?groupId returns it', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    const group = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Fixed' },
    });
    const { id: groupId } = group.json<{ id: string }>();

    const create = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Rent', groupId },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: 'GET',
      url: `/api/categories?groupId=${groupId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(list.statusCode).toBe(200);
    const { categories } = list.json<{ categories: Array<{ name: string }> }>();
    expect(categories.some((c) => c.name === 'Rent')).toBe(true);
  });
});

describe('PATCH /api/categories/:id/name', () => {
  it('renames a category and GET /api/categories shows the updated name', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    const group = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Fixed' },
    });
    const { id: groupId } = group.json<{ id: string }>();

    const create = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Old Name', groupId },
    });
    const { id: categoryId } = create.json<{ id: string }>();

    await app.inject({
      method: 'PATCH',
      url: `/api/categories/${categoryId}/name`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'New Name' },
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/categories?groupId=${groupId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    const { categories } = list.json<{ categories: Array<{ name: string }> }>();
    expect(categories.some((c) => c.name === 'New Name')).toBe(true);
    expect(categories.some((c) => c.name === 'Old Name')).toBe(false);
  });
});

describe('PATCH /api/categories/:id/group', () => {
  it('moves a category and GET /api/categories for the new group returns it', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    const groupA = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Group A' },
    });
    const { id: groupAId } = groupA.json<{ id: string }>();

    const groupB = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Group B' },
    });
    const { id: groupBId } = groupB.json<{ id: string }>();

    const create = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Food', groupId: groupAId },
    });
    const { id: categoryId } = create.json<{ id: string }>();

    const move = await app.inject({
      method: 'PATCH',
      url: `/api/categories/${categoryId}/group`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { groupId: groupBId },
    });
    expect(move.statusCode).toBe(204);

    const listB = await app.inject({
      method: 'GET',
      url: `/api/categories?groupId=${groupBId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    const { categories } = listB.json<{ categories: Array<{ name: string }> }>();
    expect(categories.some((c) => c.name === 'Food')).toBe(true);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('soft-deletes a category and GET /api/categories no longer returns it', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    const group = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Fixed' },
    });
    const { id: groupId } = group.json<{ id: string }>();

    const create = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Rent', groupId },
    });
    const { id: categoryId } = create.json<{ id: string }>();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${categoryId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: `/api/categories?groupId=${groupId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    const { categories } = list.json<{ categories: Array<{ name: string }> }>();
    expect(categories.some((c) => c.name === 'Rent')).toBe(false);
  });
});

describe('GET /api/categories', () => {
  it('seeds categories and returns them for the given groupId', async () => {
    const app = makeApp();
    const { userId, householdId } = await seed(app);

    const group = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Variable' },
    });
    const { id: groupId } = group.json<{ id: string }>();

    await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Entertainment', groupId },
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/categories?groupId=${groupId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(list.statusCode).toBe(200);
    const { categories } = list.json<{ categories: Array<{ id: string; name: string; groupId: string }> }>();
    expect(categories).toHaveLength(1);
    expect(categories[0]!.name).toBe('Entertainment');
    expect(categories[0]!.groupId).toBe(groupId);
  });
});
