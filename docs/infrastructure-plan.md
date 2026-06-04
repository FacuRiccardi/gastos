# Infrastructure Plan

## ORM & Driver
ORM: Drizzle ORM (`drizzle-orm`)
Driver: `postgres` (postgres.js — Drizzle's recommended PostgreSQL driver)
Migration tool: `drizzle-kit`

## Tables

### `households`
Aggregate: `Household`
Columns:
- `id` UUID PRIMARY KEY — HouseholdId
- `name` TEXT NOT NULL — Household.name
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

### `household_members`
Aggregate: `Household` (members collection)
Columns:
- `household_id` UUID NOT NULL — FK → households.id
- `user_id` UUID NOT NULL — UserId
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- PRIMARY KEY (`household_id`, `user_id`)

### `users`
Aggregate: `User`
Columns:
- `id` UUID PRIMARY KEY — UserId
- `name` TEXT NOT NULL — User.name
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
Note: No `household_id` column. `User.householdId` is reconstructed by querying `household_members WHERE user_id = ?`.

### `groups`
Aggregate: `Group`
Columns:
- `id` UUID PRIMARY KEY — GroupId
- `household_id` UUID NOT NULL — HouseholdId
- `name` TEXT NOT NULL — Group.name
- `deleted_at` TIMESTAMPTZ NULL — soft-delete; NULL = active
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

### `categories`
Aggregate: `Category`
Columns:
- `id` UUID PRIMARY KEY — CategoryId
- `household_id` UUID NOT NULL — HouseholdId
- `group_id` UUID NOT NULL — GroupId
- `name` TEXT NOT NULL — Category.name
- `deleted_at` TIMESTAMPTZ NULL — soft-delete; NULL = active
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

### `payment_instruments`
Aggregate: `PaymentInstrument`
Columns:
- `id` UUID PRIMARY KEY — PaymentInstrumentId
- `user_id` UUID NOT NULL — UserId
- `type` TEXT NOT NULL — PaymentInstrumentType enum (CreditCard | BankAccount)
- `name` TEXT NOT NULL — PaymentInstrument.name
- `deleted_at` TIMESTAMPTZ NULL — soft-delete; NULL = active
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

### `expenses`
Aggregate: `Expense`
Columns:
- `id` UUID PRIMARY KEY — ExpenseId
- `household_id` UUID NOT NULL — HouseholdId
- `user_id` UUID NOT NULL — UserId
- `category_id` UUID NOT NULL — CategoryId
- `money_amount` NUMERIC NOT NULL — Money.amount
- `money_currency` TEXT NOT NULL — Money.currency.code
- `payment_method_kind` TEXT NOT NULL — PaymentMethod.kind (Cash | CreditCard | BankAccount)
- `payment_method_instrument_id` UUID NULL — PaymentMethod.instrumentId.value (NULL when Cash)
- `date` DATE NOT NULL — ExpenseDate
- `installment_plan_count` INTEGER NULL — InstallmentPlan.count (NULL when not CreditCard)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

### `budget_limits`
Aggregate: `BudgetLimit`
Columns:
- `id` UUID PRIMARY KEY — BudgetLimitId
- `household_id` UUID NOT NULL — HouseholdId
- `money_amount` NUMERIC NOT NULL — Money.amount
- `money_currency` TEXT NOT NULL — Money.currency.code
- `period_kind` TEXT NOT NULL — BudgetPeriod.kind (Monthly | Rolling30Days | Custom)
- `period_start_date` TIMESTAMPTZ NULL — BudgetPeriod custom start (NULL unless Custom)
- `period_end_date` TIMESTAMPTZ NULL — BudgetPeriod custom end (NULL unless Custom)
- `category_id` UUID NULL — CategoryId (NULL when targeting a Group)
- `group_id` UUID NULL — GroupId (NULL when targeting a Category)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

## Test Isolation Strategy
Truncate before each test (`TRUNCATE ... RESTART IDENTITY CASCADE` in `beforeEach`).
Reason: simpler than transaction rollback with Drizzle; no need to pass transaction objects through repositories.

## Test Helper Location
`tests/integration/helpers/testDb.ts` — exports `testDb` (Drizzle instance pointing at `TEST_DATABASE_URL`) and `clearTables()` (truncates all tables).
