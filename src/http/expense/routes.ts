import type { FastifyPluginAsync } from 'fastify';
import type { Repositories } from '../types.js';
import { requireUserId, requireHouseholdId } from '../auth.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { UserId } from '../../domain/identity/user/UserId.js';
import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { ExpenseId } from '../../domain/expense/ExpenseId.js';
import { ExpenseDate } from '../../domain/expense/ExpenseDate.js';
import { Money } from '../../domain/shared/Money.js';
import { Currency } from '../../domain/shared/Currency.js';
import { InstallmentPlan } from '../../domain/expense/InstallmentPlan.js';
import { PaymentInstrumentId } from '../../domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentType } from '../../domain/expense/payment-instrument/PaymentInstrumentType.js';
import { ExpenseFilters } from '../../domain/expense/ExpenseFilters.js';
import { Pagination } from '../../domain/shared/Pagination.js';
import { PaymentMethod } from '../../domain/expense/PaymentMethod.js';
import type { Expense } from '../../domain/expense/Expense.js';
import type { PaymentInstrument } from '../../domain/expense/payment-instrument/PaymentInstrument.js';
import { LogExpense } from '../../application/expense/LogExpense.js';
import { DeleteExpense } from '../../application/expense/DeleteExpense.js';
import { ListExpenses } from '../../application/expense/ListExpenses.js';
import { CreatePaymentInstrument } from '../../application/expense/payment-instrument/CreatePaymentInstrument.js';
import { RenamePaymentInstrument } from '../../application/expense/payment-instrument/RenamePaymentInstrument.js';
import { SoftDeletePaymentInstrument } from '../../application/expense/payment-instrument/SoftDeletePaymentInstrument.js';
import { ListPaymentInstruments } from '../../application/expense/payment-instrument/ListPaymentInstruments.js';

type RequestWithAuth = { userId: string; householdId: string };

function mapExpense(e: Expense) {
  const base = {
    id: e.id,
    householdId: e.householdId,
    userId: e.userId,
    categoryId: e.categoryId,
    money: { amount: e.money.amount, currency: e.money.currency.code },
    paymentMethod: e.paymentMethod.kind === 'Cash'
      ? { kind: 'Cash' }
      : { kind: e.paymentMethod.kind, instrumentId: e.paymentMethod.instrumentId },
    date: e.date.toDate().toISOString().split('T')[0],
  };
  if (e.installmentPlan) {
    return { ...base, installmentPlan: { count: e.installmentPlan.count } };
  }
  return base;
}

function mapInstrument(i: PaymentInstrument) {
  return { id: i.id, userId: i.userId, type: i.type, name: i.name };
}

export function expenseRoutes(repos: Repositories): FastifyPluginAsync {
  return async (app) => {
    // ── Expenses ───────────────────────────────────────────────────────────────

    app.post('/expenses', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        body: {
          type: 'object',
          required: ['categoryId', 'money', 'paymentMethod', 'date'],
          properties: {
            categoryId: { type: 'string' },
            money: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: { amount: { type: 'number' }, currency: { type: 'string' } },
            },
            paymentMethod: {
              type: 'object',
              required: ['kind'],
              properties: {
                kind: { type: 'string' },
                instrumentId: { type: 'string' },
              },
            },
            date: { type: 'string' },
            installmentPlan: {
              type: 'object',
              properties: { count: { type: 'integer' } },
            },
          },
        },
      },
    }, async (request, reply) => {
      const req = request as typeof request & RequestWithAuth;
      const body = request.body as {
        categoryId: string;
        money: { amount: number; currency: string };
        paymentMethod: { kind: string; instrumentId?: string };
        date: string;
        installmentPlan?: { count: number };
      };
      const useCase = new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments);
      const { id } = await useCase.execute({
        householdId: HouseholdId.from(req.householdId),
        userId: UserId.from(req.userId),
        categoryId: CategoryId.from(body.categoryId),
        money: new Money(body.money.amount, Currency.from(body.money.currency)),
        paymentMethod: PaymentMethod.from(body.paymentMethod),
        date: new ExpenseDate(new Date(body.date)),
        installmentPlan: body.installmentPlan ? new InstallmentPlan(body.installmentPlan.count) : undefined,
      });
      return reply.code(201).send({ id });
    });

    app.delete('/expenses/:id', {
      preHandler: [requireUserId, requireHouseholdId],
    }, async (request, reply) => {
      const req = request as typeof request & RequestWithAuth;
      const { id } = request.params as { id: string };
      const useCase = new DeleteExpense(repos.expenses);
      await useCase.execute({ id: ExpenseId.from(id), householdId: HouseholdId.from(req.householdId) });
      return reply.code(204).send();
    });

    app.get('/expenses', {
      preHandler: [requireUserId, requireHouseholdId],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1 },
            offset: { type: 'integer', minimum: 0 },
            from: { type: 'string' },
            to: { type: 'string' },
            categoryId: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
            paymentInstrumentId: { type: 'string' },
            groupId: { type: 'string' },
          },
        },
      },
    }, async (request, reply) => {
      const req = request as typeof request & RequestWithAuth;
      const query = request.query as {
        from?: string;
        to?: string;
        categoryId?: string | string[];
        paymentInstrumentId?: string;
        groupId?: string;
        limit?: number;
        offset?: number;
      };

      const categoryIds = query.categoryId
        ? (Array.isArray(query.categoryId) ? query.categoryId : [query.categoryId]).map(CategoryId.from)
        : undefined;

      const filters = new ExpenseFilters(
        query.from ? new ExpenseDate(new Date(query.from)) : undefined,
        query.to ? new ExpenseDate(new Date(query.to)) : undefined,
        categoryIds,
        query.paymentInstrumentId ? PaymentInstrumentId.from(query.paymentInstrumentId) : undefined,
      );

      const useCase = new ListExpenses(repos.expenses, repos.categories);
      const { page } = await useCase.execute({
        householdId: HouseholdId.from(req.householdId),
        filters,
        groupId: query.groupId ? GroupId.from(query.groupId) : undefined,
        pagination: new Pagination(query.limit ?? 20, query.offset ?? 0),
      });

      return reply.code(200).send({ items: page.items.map(mapExpense), total: page.total });
    });

    // ── Payment Instruments ────────────────────────────────────────────────────

    app.post('/payment-instruments', {
      preHandler: requireUserId,
      schema: {
        body: {
          type: 'object',
          required: ['type', 'name'],
          properties: {
            type: { type: 'string', enum: ['CreditCard', 'BankAccount'] },
            name: { type: 'string', minLength: 1 },
          },
        },
      },
    }, async (request, reply) => {
      const req = request as typeof request & { userId: string };
      const { type, name } = request.body as { type: string; name: string };
      const useCase = new CreatePaymentInstrument(repos.paymentInstruments);
      const { id } = await useCase.execute({
        userId: UserId.from(req.userId),
        type: PaymentInstrumentType[type as keyof typeof PaymentInstrumentType],
        name,
      });
      return reply.code(201).send({ id });
    });

    app.patch('/payment-instruments/:id/name', {
      preHandler: requireUserId,
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1 } },
        },
      },
    }, async (request, reply) => {
      const req = request as typeof request & { userId: string };
      const { id } = request.params as { id: string };
      const { name } = request.body as { name: string };
      const useCase = new RenamePaymentInstrument(repos.paymentInstruments);
      await useCase.execute({ id: PaymentInstrumentId.from(id), newName: name, userId: UserId.from(req.userId) });
      return reply.code(204).send();
    });

    app.delete('/payment-instruments/:id', {
      preHandler: requireUserId,
    }, async (request, reply) => {
      const req = request as typeof request & { userId: string };
      const { id } = request.params as { id: string };
      const useCase = new SoftDeletePaymentInstrument(repos.paymentInstruments);
      await useCase.execute({ id: PaymentInstrumentId.from(id), userId: UserId.from(req.userId) });
      return reply.code(204).send();
    });

    app.get('/payment-instruments', {
      preHandler: requireUserId,
    }, async (request, reply) => {
      const req = request as typeof request & { userId: string };
      const useCase = new ListPaymentInstruments(repos.paymentInstruments);
      const { instruments } = await useCase.execute({ userId: UserId.from(req.userId) });
      return reply.code(200).send({ instruments: instruments.map(mapInstrument) });
    });
  };
}
