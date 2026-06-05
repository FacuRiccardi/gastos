import type { FastifyPluginAsync } from 'fastify';
import type { Repositories } from '../types.js';
import { requireUserId } from '../auth.js';
import { UserId } from '../../domain/identity/user/UserId.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { CreateUser } from '../../application/identity/CreateUser.js';
import { CreateHousehold } from '../../application/identity/CreateHousehold.js';
import { JoinHousehold } from '../../application/identity/JoinHousehold.js';

export function identityRoutes(repos: Repositories): FastifyPluginAsync {
  return async (app) => {
    app.post('/users', {
      schema: {
        security: [],
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1 } },
        },
      },
    }, async (request, reply) => {
      const { name } = request.body as { name: string };
      const useCase = new CreateUser(repos.users);
      const { id } = await useCase.execute({ name });
      return reply.code(201).send({ id });
    });

    app.post('/households', {
      preHandler: requireUserId,
      schema: {
        security: [{ userId: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1 } },
        },
      },
    }, async (request, reply) => {
      const req = request as typeof request & { userId: string };
      const { name } = request.body as { name: string };
      const useCase = new CreateHousehold(repos.households, repos.users);
      const { id } = await useCase.execute({ name, creatorId: UserId.from(req.userId) });
      return reply.code(201).send({ id });
    });

    app.post('/households/:id/members', {
      preHandler: requireUserId,
      schema: { security: [{ userId: [] }] },
    }, async (request, reply) => {
      const req = request as typeof request & { userId: string };
      const { id } = request.params as { id: string };
      const useCase = new JoinHousehold(repos.households, repos.users);
      await useCase.execute({ userId: UserId.from(req.userId), householdId: HouseholdId.from(id) });
      return reply.code(204).send();
    });
  };
}
