import type { FastifyPluginAsync } from 'fastify';
import type { Repositories } from '../types.js';
import { requireUserId, requireHouseholdId } from '../auth.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { BudgetLimitId } from '../../domain/budget/BudgetLimitId.js';
import { BudgetPeriod } from '../../domain/budget/BudgetPeriod.js';
import { Money } from '../../domain/shared/Money.js';
import { Currency } from '../../domain/shared/Currency.js';
import type { BudgetLimit } from '../../domain/budget/BudgetLimit.js';
import { ApplicationError } from '../../application/ApplicationError.js';
import { CreateBudgetLimit } from '../../application/budget/CreateBudgetLimit.js';
import { EditBudgetLimit } from '../../application/budget/EditBudgetLimit.js';
import { DeleteBudgetLimit } from '../../application/budget/DeleteBudgetLimit.js';
import { GetBudgetLimitBalance } from '../../application/budget/GetBudgetLimitBalance.js';
import { ListBudgetLimits } from '../../application/budget/ListBudgetLimits.js';

function parsePeriod(p: { kind: string; startDate?: string; endDate?: string }): BudgetPeriod {
  if (p.kind === 'Monthly') return BudgetPeriod.monthly();
  if (p.kind === 'Rolling30Days') return BudgetPeriod.rolling30Days();
  if (p.kind === 'Custom' && p.startDate && p.endDate) {
    return BudgetPeriod.custom(new Date(p.startDate), new Date(p.endDate));
  }
  throw new ApplicationError(`Invalid period kind: ${p.kind}`);
}

function mapPeriod(period: BudgetPeriod): object {
  if (period.kind === 'Monthly') return { kind: 'Monthly' };
  if (period.kind === 'Rolling30Days') return { kind: 'Rolling30Days' };
  const { from, to } = period.getDateRange(new Date());
  return {
    kind: 'Custom',
    startDate: from.toDate().toISOString().split('T')[0],
    endDate: to.toDate().toISOString().split('T')[0],
  };
}

function mapLimit(l: BudgetLimit) {
  return {
    id: l.id,
    money: { amount: l.money.amount, currency: l.money.currency.code },
    period: mapPeriod(l.period),
    ...(l.categoryId !== undefined && { categoryId: l.categoryId }),
    ...(l.groupId !== undefined && { groupId: l.groupId }),
  };
}

export function budgetRoutes(repos: Repositories): FastifyPluginAsync {
  return async (app) => {
    app.post('/budget-limits', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        body: {
          type: 'object',
          required: ['money', 'period'],
          properties: {
            money: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: { amount: { type: 'number' }, currency: { type: 'string' } },
            },
            period: {
              type: 'object',
              required: ['kind'],
              properties: {
                kind: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
              },
            },
            categoryId: { type: 'string' },
            groupId: { type: 'string' },
          },
        },
      },
    }, async (request, reply) => {
      const req = request as typeof request & { householdId: string };
      const body = request.body as {
        money: { amount: number; currency: string };
        period: { kind: string; startDate?: string; endDate?: string };
        categoryId?: string;
        groupId?: string;
      };
      const useCase = new CreateBudgetLimit(repos.budgetLimits);
      const { id } = await useCase.execute({
        householdId: HouseholdId.from(req.householdId),
        money: new Money(body.money.amount, Currency.from(body.money.currency)),
        period: parsePeriod(body.period),
        categoryId: body.categoryId ? CategoryId.from(body.categoryId) : undefined,
        groupId: body.groupId ? GroupId.from(body.groupId) : undefined,
      });
      return reply.code(201).send({ id });
    });

    app.patch('/budget-limits/:id', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        body: {
          type: 'object',
          required: ['money', 'period'],
          properties: {
            money: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: { amount: { type: 'number' }, currency: { type: 'string' } },
            },
            period: {
              type: 'object',
              required: ['kind'],
              properties: {
                kind: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
              },
            },
          },
        },
      },
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        money: { amount: number; currency: string };
        period: { kind: string; startDate?: string; endDate?: string };
      };
      const useCase = new EditBudgetLimit(repos.budgetLimits);
      await useCase.execute({
        id: BudgetLimitId.from(id),
        money: new Money(body.money.amount, Currency.from(body.money.currency)),
        period: parsePeriod(body.period),
      });
      return reply.code(204).send();
    });

    app.delete('/budget-limits/:id', {
      preHandler: [requireUserId, requireHouseholdId],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const useCase = new DeleteBudgetLimit(repos.budgetLimits);
      await useCase.execute({ id: BudgetLimitId.from(id) });
      return reply.code(204).send();
    });

    app.get('/budget-limits/:id/balance', {
      preHandler: [requireUserId, requireHouseholdId],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const useCase = new GetBudgetLimitBalance(repos.budgetLimits, repos.expenses, repos.categories);
      const { remaining } = await useCase.execute({ id: BudgetLimitId.from(id) });
      return reply.code(200).send({
        remaining: { amount: remaining.amount, currency: remaining.currency.code },
      });
    });

    app.get('/budget-limits', {
      preHandler: [requireUserId, requireHouseholdId],
    }, async (request, reply) => {
      const req = request as typeof request & { householdId: string };
      const useCase = new ListBudgetLimits(repos.budgetLimits);
      const { limits } = await useCase.execute({ householdId: HouseholdId.from(req.householdId) });
      return reply.code(200).send({ limits: limits.map(mapLimit) });
    });
  };
}
