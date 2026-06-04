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
import { GroupId } from '../../../src/domain/catalogue/group/GroupId.js';
import { CategoryId } from '../../../src/domain/catalogue/category/CategoryId.js';
import { UserId } from '../../../src/domain/identity/user/UserId.js';
import { Group } from '../../../src/domain/catalogue/group/Group.js';
import { Category } from '../../../src/domain/catalogue/category/Category.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const householdId = HouseholdId.generate();
const userId = UserId.generate();

function makeApp(
  groups = new InMemoryGroupRepository(),
  categories = new InMemoryCategoryRepository(),
) {
  return buildApp({
    households: new InMemoryHouseholdRepository(),
    users: new InMemoryUserRepository(),
    groups,
    categories,
    expenses: new InMemoryExpenseRepository(),
    paymentInstruments: new InMemoryPaymentInstrumentRepository(),
    budgetLimits: new InMemoryBudgetLimitRepository(),
  });
}

// ─── POST /api/groups ─────────────────────────────────────────────────────────

describe('POST /api/groups', () => {
  it('returns 201 with { id: string } for valid body + headers', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Fixed Expenses' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ id: string }>().id).toMatch(UUID_RE);
  });

  it('returns 400 when X-User-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-household-id': householdId },
      payload: { name: 'Fixed Expenses' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when X-Household-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId },
      payload: { name: 'Fixed Expenses' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when name is missing from body', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });
});

// ─── PATCH /api/groups/:id/name ───────────────────────────────────────────────

describe('PATCH /api/groups/:id/name', () => {
  it('returns 204 for valid request', async () => {
    const groups = new InMemoryGroupRepository();
    const groupId = GroupId.generate();
    await groups.save(new Group(groupId, householdId, 'Old Name'));
    const response = await makeApp(groups).inject({
      method: 'PATCH',
      url: `/api/groups/${groupId}/name`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when X-User-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/groups/${GroupId.generate()}/name`,
      headers: { 'x-household-id': householdId },
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when name is missing from body', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/groups/${GroupId.generate()}/name`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when group is not found', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/groups/${GroupId.generate()}/name`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── DELETE /api/groups/:id ───────────────────────────────────────────────────

describe('DELETE /api/groups/:id', () => {
  it('returns 204 for valid request', async () => {
    const groups = new InMemoryGroupRepository();
    const groupId = GroupId.generate();
    await groups.save(new Group(groupId, householdId, 'Groceries'));
    const response = await makeApp(groups).inject({
      method: 'DELETE',
      url: `/api/groups/${groupId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when X-User-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: `/api/groups/${GroupId.generate()}`,
      headers: { 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when group is not found', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: `/api/groups/${GroupId.generate()}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 422 when group is already deleted (DomainError → 422 mapping)', async () => {
    const groups = new InMemoryGroupRepository();
    const groupId = GroupId.generate();
    const deletedGroup = new Group(groupId, householdId, 'Groceries', new Date());
    await groups.save(deletedGroup);
    const response = await makeApp(groups).inject({
      method: 'DELETE',
      url: `/api/groups/${groupId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(422);
  });
});

// ─── GET /api/groups ──────────────────────────────────────────────────────────

describe('GET /api/groups', () => {
  it('returns 200 with { groups: Array<{ id, name }> }', async () => {
    const groups = new InMemoryGroupRepository();
    const groupId = GroupId.generate();
    await groups.save(new Group(groupId, householdId, 'Fixed Expenses'));
    const response = await makeApp(groups).inject({
      method: 'GET',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ groups: Array<{ id: string; name: string }> }>();
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0]).toMatchObject({ id: groupId, name: 'Fixed Expenses' });
  });

  it('returns 400 when X-Household-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/groups',
      headers: { 'x-user-id': userId },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 200 with empty array when no groups exist', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/groups',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ groups: unknown[] }>().groups).toHaveLength(0);
  });
});

// ─── POST /api/categories ─────────────────────────────────────────────────────

describe('POST /api/categories', () => {
  it('returns 201 with { id: string } for valid body + headers', async () => {
    const groups = new InMemoryGroupRepository();
    const groupId = GroupId.generate();
    await groups.save(new Group(groupId, householdId, 'Fixed Expenses'));
    const response = await makeApp(groups).inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Rent', groupId },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ id: string }>().id).toMatch(UUID_RE);
  });

  it('returns 400 when X-Household-Id is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId },
      payload: { name: 'Rent', groupId: GroupId.generate() },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when name or groupId is missing from body', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Rent' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when group is not found', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'Rent', groupId: GroupId.generate() },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── PATCH /api/categories/:id/name ──────────────────────────────────────────

describe('PATCH /api/categories/:id/name', () => {
  it('returns 204 for valid request', async () => {
    const categories = new InMemoryCategoryRepository();
    const categoryId = CategoryId.generate();
    const groupId = GroupId.generate();
    await categories.save(new Category(categoryId, householdId, groupId, 'Old Name'));
    const response = await makeApp(new InMemoryGroupRepository(), categories).inject({
      method: 'PATCH',
      url: `/api/categories/${categoryId}/name`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when name is missing from body', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/categories/${CategoryId.generate()}/name`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when category is not found', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/categories/${CategoryId.generate()}/name`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── PATCH /api/categories/:id/group ─────────────────────────────────────────

describe('PATCH /api/categories/:id/group', () => {
  it('returns 204 for valid request', async () => {
    const groups = new InMemoryGroupRepository();
    const categories = new InMemoryCategoryRepository();
    const groupId = GroupId.generate();
    const newGroupId = GroupId.generate();
    const categoryId = CategoryId.generate();
    await groups.save(new Group(groupId, householdId, 'Group A'));
    await groups.save(new Group(newGroupId, householdId, 'Group B'));
    await categories.save(new Category(categoryId, householdId, groupId, 'Rent'));
    const response = await makeApp(groups, categories).inject({
      method: 'PATCH',
      url: `/api/categories/${categoryId}/group`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { groupId: newGroupId },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 400 when groupId is missing from body', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/categories/${CategoryId.generate()}/group`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when category is not found', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: `/api/categories/${CategoryId.generate()}/group`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { groupId: GroupId.generate() },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when target group is not found', async () => {
    const categories = new InMemoryCategoryRepository();
    const categoryId = CategoryId.generate();
    const groupId = GroupId.generate();
    await categories.save(new Category(categoryId, householdId, groupId, 'Rent'));
    const response = await makeApp(new InMemoryGroupRepository(), categories).inject({
      method: 'PATCH',
      url: `/api/categories/${categoryId}/group`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
      payload: { groupId: GroupId.generate() },
    });
    expect(response.statusCode).toBe(404);
  });
});

// ─── DELETE /api/categories/:id ───────────────────────────────────────────────

describe('DELETE /api/categories/:id', () => {
  it('returns 204 for valid request', async () => {
    const categories = new InMemoryCategoryRepository();
    const categoryId = CategoryId.generate();
    await categories.save(new Category(categoryId, householdId, GroupId.generate(), 'Food'));
    const response = await makeApp(new InMemoryGroupRepository(), categories).inject({
      method: 'DELETE',
      url: `/api/categories/${categoryId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(204);
  });

  it('returns 404 when category is not found', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: `/api/categories/${CategoryId.generate()}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 422 when category is already deleted', async () => {
    const categories = new InMemoryCategoryRepository();
    const categoryId = CategoryId.generate();
    await categories.save(new Category(categoryId, householdId, GroupId.generate(), 'Food', new Date()));
    const response = await makeApp(new InMemoryGroupRepository(), categories).inject({
      method: 'DELETE',
      url: `/api/categories/${categoryId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(422);
  });
});

// ─── GET /api/categories ──────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  it('returns 200 with { categories: Array<{ id, name, groupId }> }', async () => {
    const groups = new InMemoryGroupRepository();
    const categories = new InMemoryCategoryRepository();
    const groupId = GroupId.generate();
    const categoryId = CategoryId.generate();
    await groups.save(new Group(groupId, householdId, 'Fixed'));
    await categories.save(new Category(categoryId, householdId, groupId, 'Rent'));
    const response = await makeApp(groups, categories).inject({
      method: 'GET',
      url: `/api/categories?groupId=${groupId}`,
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ categories: Array<{ id: string; name: string; groupId: string }> }>();
    expect(body.categories).toHaveLength(1);
    expect(body.categories[0]).toMatchObject({ id: categoryId, name: 'Rent', groupId });
  });

  it('returns 400 when groupId query param is missing', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/api/categories',
      headers: { 'x-user-id': userId, 'x-household-id': householdId },
    });
    expect(response.statusCode).toBe(400);
  });
});
