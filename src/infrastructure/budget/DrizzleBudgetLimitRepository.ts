import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { budgetLimits } from '../db/schema/budget.js';
import { BudgetLimit } from '../../domain/budget/BudgetLimit.js';
import type { BudgetLimitRepository } from '../../domain/budget/BudgetLimitRepository.js';
import { BudgetLimitId } from '../../domain/budget/BudgetLimitId.js';
import { BudgetPeriod } from '../../domain/budget/BudgetPeriod.js';
import { Money } from '../../domain/shared/Money.js';
import { Currency } from '../../domain/shared/Currency.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';

export class DrizzleBudgetLimitRepository implements BudgetLimitRepository {
  constructor(private readonly db: Db) {}

  async findById(id: BudgetLimitId): Promise<BudgetLimit | null> {
    const rows = await this.db.select().from(budgetLimits).where(eq(budgetLimits.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByHousehold(householdId: HouseholdId): Promise<BudgetLimit[]> {
    const rows = await this.db.select().from(budgetLimits).where(eq(budgetLimits.householdId, householdId));
    return rows.map((r) => this.toDomain(r));
  }

  async save(limit: BudgetLimit): Promise<void> {
    const row = this.toRow(limit);
    const now = new Date();
    await this.db
      .insert(budgetLimits)
      .values({ ...row, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: budgetLimits.id,
        set: {
          moneyAmount: row.moneyAmount,
          moneyCurrency: row.moneyCurrency,
          periodKind: row.periodKind,
          periodStartDate: row.periodStartDate,
          periodEndDate: row.periodEndDate,
          categoryId: row.categoryId,
          groupId: row.groupId,
          updatedAt: now,
        },
      });
  }

  async delete(id: BudgetLimitId): Promise<void> {
    await this.db.delete(budgetLimits).where(eq(budgetLimits.id, id));
  }

  private toDomain(row: typeof budgetLimits.$inferSelect): BudgetLimit {
    const money = new Money(parseFloat(row.moneyAmount), Currency.from(row.moneyCurrency));
    const period = this.toPeriod(row);

    if (row.categoryId) {
      return BudgetLimit.forCategory(
        BudgetLimitId.from(row.id),
        HouseholdId.from(row.householdId),
        money,
        period,
        CategoryId.from(row.categoryId),
      );
    }
    return BudgetLimit.forGroup(
      BudgetLimitId.from(row.id),
      HouseholdId.from(row.householdId),
      money,
      period,
      GroupId.from(row.groupId!),
    );
  }

  private toPeriod(row: typeof budgetLimits.$inferSelect): BudgetPeriod {
    if (row.periodKind === 'Monthly') return BudgetPeriod.monthly();
    if (row.periodKind === 'Rolling30Days') return BudgetPeriod.rolling30Days();
    return BudgetPeriod.custom(row.periodStartDate!, row.periodEndDate!);
  }

  private toRow(limit: BudgetLimit): typeof budgetLimits.$inferInsert {
    return {
      id: limit.id,
      householdId: limit.householdId,
      moneyAmount: String(limit.money.amount),
      moneyCurrency: limit.money.currency.code,
      periodKind: limit.period.kind,
      periodStartDate: limit.period.kind === 'Custom'
        ? limit.period.getDateRange(new Date()).from.toDate()
        : null,
      periodEndDate: limit.period.kind === 'Custom'
        ? limit.period.getDateRange(new Date()).to.toDate()
        : null,
      categoryId: limit.categoryId ?? null,
      groupId: limit.groupId ?? null,
    };
  }
}
