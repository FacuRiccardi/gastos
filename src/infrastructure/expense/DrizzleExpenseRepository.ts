import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { expenses } from '../db/schema/expense.js';
import { Expense } from '../../domain/expense/Expense.js';
import type { ExpenseRepository } from '../../domain/expense/ExpenseRepository.js';
import { ExpenseId } from '../../domain/expense/ExpenseId.js';
import { ExpenseDate } from '../../domain/expense/ExpenseDate.js';
import { ExpenseFilters } from '../../domain/expense/ExpenseFilters.js';
import { InstallmentPlan } from '../../domain/expense/InstallmentPlan.js';
import type { PaymentMethod } from '../../domain/expense/PaymentMethod.js';
import { Money } from '../../domain/shared/Money.js';
import { Currency } from '../../domain/shared/Currency.js';
import type { Page } from '../../domain/shared/Page.js';
import type { Pagination } from '../../domain/shared/Pagination.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { UserId } from '../../domain/identity/user/UserId.js';
import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { PaymentInstrumentId } from '../../domain/expense/payment-instrument/PaymentInstrumentId.js';
import { Page as PageImpl } from '../../domain/shared/Page.js';

export class DrizzleExpenseRepository implements ExpenseRepository {
  constructor(private readonly db: Db) {}

  async findById(id: ExpenseId): Promise<Expense | null> {
    const rows = await this.db.select().from(expenses).where(eq(expenses.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByHousehold(
    householdId: HouseholdId,
    filters: ExpenseFilters,
    pagination: Pagination,
  ): Promise<Page<Expense>> {
    const conditions = this.buildConditions(householdId, filters);

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(expenses)
        .where(and(...conditions))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(expenses)
        .where(and(...conditions)),
    ]);

    const total = countRows[0]?.count ?? 0;
    return new PageImpl(rows.map((r) => this.toDomain(r)), total);
  }

  async sumAmountByHousehold(householdId: HouseholdId, filters: ExpenseFilters): Promise<number> {
    const conditions = this.buildConditions(householdId, filters);
    const rows = await this.db
      .select({ total: sql<string>`coalesce(sum(money_amount), 0)` })
      .from(expenses)
      .where(and(...conditions));
    return parseFloat(rows[0]?.total ?? '0');
  }

  async save(expense: Expense): Promise<void> {
    const row = this.toRow(expense);
    const now = new Date();
    await this.db
      .insert(expenses)
      .values({ ...row, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: expenses.id,
        set: {
          categoryId: row.categoryId,
          moneyAmount: row.moneyAmount,
          moneyCurrency: row.moneyCurrency,
          paymentMethodKind: row.paymentMethodKind,
          paymentMethodInstrumentId: row.paymentMethodInstrumentId,
          date: row.date,
          installmentPlanCount: row.installmentPlanCount,
          updatedAt: now,
        },
      });
  }

  async delete(id: ExpenseId): Promise<void> {
    await this.db.delete(expenses).where(eq(expenses.id, id));
  }

  private buildConditions(householdId: HouseholdId, filters: ExpenseFilters) {
    const conditions = [eq(expenses.householdId, householdId)];

    if (filters.from) {
      conditions.push(gte(expenses.date, this.formatDate(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(expenses.date, this.formatDate(filters.to)));
    }
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      conditions.push(inArray(expenses.categoryId, filters.categoryIds));
    }
    if (filters.paymentInstrumentId) {
      conditions.push(eq(expenses.paymentMethodInstrumentId, filters.paymentInstrumentId));
    }

    return conditions;
  }

  private parseDate(dateStr: string): ExpenseDate {
    const [y, m, day] = dateStr.split('-').map(Number);
    return new ExpenseDate(new Date(y!, m! - 1, day!));
  }

  private formatDate(d: ExpenseDate): string {
    const dt = d.toDate();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toDomain(row: typeof expenses.$inferSelect): Expense {
    const paymentMethod = this.toPaymentMethod(row);
    const installmentPlan = row.installmentPlanCount != null
      ? new InstallmentPlan(row.installmentPlanCount)
      : undefined;

    return new Expense(
      ExpenseId.from(row.id),
      HouseholdId.from(row.householdId),
      UserId.from(row.userId),
      CategoryId.from(row.categoryId),
      new Money(parseFloat(row.moneyAmount), Currency.from(row.moneyCurrency)),
      paymentMethod,
      this.parseDate(row.date),
      installmentPlan,
    );
  }

  private toPaymentMethod(row: typeof expenses.$inferSelect): PaymentMethod {
    if (row.paymentMethodKind === 'Cash') return { kind: 'Cash' };
    if (row.paymentMethodKind === 'CreditCard') {
      return { kind: 'CreditCard', instrumentId: PaymentInstrumentId.from(row.paymentMethodInstrumentId!) };
    }
    return { kind: 'BankAccount', instrumentId: PaymentInstrumentId.from(row.paymentMethodInstrumentId!) };
  }

  private toRow(expense: Expense): typeof expenses.$inferInsert {
    const instrumentId = expense.paymentMethod.kind !== 'Cash'
      ? expense.paymentMethod.instrumentId
      : null;

    return {
      id: expense.id,
      householdId: expense.householdId,
      userId: expense.userId,
      categoryId: expense.categoryId,
      moneyAmount: String(expense.money.amount),
      moneyCurrency: expense.money.currency.code,
      paymentMethodKind: expense.paymentMethod.kind,
      paymentMethodInstrumentId: instrumentId,
      date: this.formatDate(expense.date),
      installmentPlanCount: expense.installmentPlan?.count ?? null,
    };
  }
}
