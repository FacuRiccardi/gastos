import type { FastifyPluginAsync } from 'fastify';
import type { Repositories } from '../types.js';
import { requireUserId, requireHouseholdId } from '../auth.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { CreateGroup } from '../../application/catalogue/CreateGroup.js';
import { RenameGroup } from '../../application/catalogue/RenameGroup.js';
import { SoftDeleteGroup } from '../../application/catalogue/SoftDeleteGroup.js';
import { ListGroups } from '../../application/catalogue/ListGroups.js';
import { CreateCategory } from '../../application/catalogue/CreateCategory.js';
import { RenameCategory } from '../../application/catalogue/RenameCategory.js';
import { MoveCategory } from '../../application/catalogue/MoveCategory.js';
import { SoftDeleteCategory } from '../../application/catalogue/SoftDeleteCategory.js';
import { ListCategories } from '../../application/catalogue/ListCategories.js';

export function catalogueRoutes(repos: Repositories): FastifyPluginAsync {
  return async (app) => {
    // ── Groups ────────────────────────────────────────────────────────────────

    app.post('/groups', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1 } },
        },
      },
    }, async (request, reply) => {
      const req = request as typeof request & { householdId: string };
      const { name } = request.body as { name: string };
      const useCase = new CreateGroup(repos.groups);
      const { id } = await useCase.execute({ name, householdId: HouseholdId.from(req.householdId) });
      return reply.code(201).send({ id });
    });

    app.patch('/groups/:id/name', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1 } },
        },
      },
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name } = request.body as { name: string };
      const useCase = new RenameGroup(repos.groups);
      await useCase.execute({ id: GroupId.from(id), newName: name });
      return reply.code(204).send();
    });

    app.delete('/groups/:id', {
      preHandler: [requireUserId, requireHouseholdId],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const useCase = new SoftDeleteGroup(repos.groups);
      await useCase.execute({ id: GroupId.from(id) });
      return reply.code(204).send();
    });

    app.get('/groups', {
      preHandler: [requireUserId, requireHouseholdId],
    }, async (request, reply) => {
      const req = request as typeof request & { householdId: string };
      const useCase = new ListGroups(repos.groups);
      const { groups } = await useCase.execute({ householdId: HouseholdId.from(req.householdId) });
      return reply.code(200).send({
        groups: groups.map((g) => ({ id: g.id, name: g.name })),
      });
    });

    // ── Categories ────────────────────────────────────────────────────────────

    app.post('/categories', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'groupId'],
          properties: {
            name: { type: 'string', minLength: 1 },
            groupId: { type: 'string', minLength: 1 },
          },
        },
      },
    }, async (request, reply) => {
      const req = request as typeof request & { householdId: string };
      const { name, groupId } = request.body as { name: string; groupId: string };
      const useCase = new CreateCategory(repos.categories, repos.groups);
      const { id } = await useCase.execute({
        name,
        groupId: GroupId.from(groupId),
        householdId: HouseholdId.from(req.householdId),
      });
      return reply.code(201).send({ id });
    });

    app.patch('/categories/:id/name', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1 } },
        },
      },
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name } = request.body as { name: string };
      const useCase = new RenameCategory(repos.categories);
      await useCase.execute({ id: CategoryId.from(id), newName: name });
      return reply.code(204).send();
    });

    app.patch('/categories/:id/group', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        body: {
          type: 'object',
          required: ['groupId'],
          properties: { groupId: { type: 'string', minLength: 1 } },
        },
      },
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const { groupId } = request.body as { groupId: string };
      const useCase = new MoveCategory(repos.categories, repos.groups);
      await useCase.execute({ id: CategoryId.from(id), targetGroupId: GroupId.from(groupId) });
      return reply.code(204).send();
    });

    app.delete('/categories/:id', {
      preHandler: [requireUserId, requireHouseholdId],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const useCase = new SoftDeleteCategory(repos.categories);
      await useCase.execute({ id: CategoryId.from(id) });
      return reply.code(204).send();
    });

    app.get('/categories', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        querystring: {
          type: 'object',
          required: ['groupId'],
          properties: { groupId: { type: 'string', minLength: 1 } },
        },
      },
    }, async (request, reply) => {
      const { groupId } = request.query as { groupId: string };
      const useCase = new ListCategories(repos.categories);
      const { categories } = await useCase.execute({ groupId: GroupId.from(groupId) });
      return reply.code(200).send({
        categories: categories.map((c) => ({ id: c.id, name: c.name, groupId: c.groupId })),
      });
    });
  };
}
