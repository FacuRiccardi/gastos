import { pgTable, uuid, text, timestamp, numeric } from 'drizzle-orm/pg-core';

export const budgetLimits = pgTable('budget_limits', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id').notNull(),
  moneyAmount: numeric('money_amount').notNull(),
  moneyCurrency: text('money_currency').notNull(),
  periodKind: text('period_kind').notNull(),
  periodStartDate: timestamp('period_start_date', { withTimezone: true }),
  periodEndDate: timestamp('period_end_date', { withTimezone: true }),
  categoryId: uuid('category_id'),
  groupId: uuid('group_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
