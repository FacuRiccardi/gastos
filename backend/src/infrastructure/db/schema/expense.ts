import { pgTable, uuid, text, timestamp, numeric, integer, date } from 'drizzle-orm/pg-core';

export const paymentInstruments = pgTable('payment_instruments', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id').notNull(),
  userId: uuid('user_id').notNull(),
  categoryId: uuid('category_id').notNull(),
  moneyAmount: numeric('money_amount').notNull(),
  moneyCurrency: text('money_currency').notNull(),
  paymentMethodKind: text('payment_method_kind').notNull(),
  paymentMethodInstrumentId: uuid('payment_method_instrument_id'),
  date: date('date').notNull(),
  installmentPlanCount: integer('installment_plan_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
