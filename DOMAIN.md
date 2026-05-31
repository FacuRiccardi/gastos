# Gastos — Domain Rules

## Purpose
A web app for a household to log individual expenses and track spending against shared budget limits by category and group.

## Target User
Facundo and his girlfriend, each logging expenses independently from a web browser, within a shared Household.

## Core Problem
Spreadsheets are too manual and enforce no spending limits. There is no shared view of spending accessible from two different devices.

## Scope

### In Scope
- Logging expenses with amount, category, payment method, and optional installment plan
- Category and Group taxonomy (the Catalogue), shared per Household
- Budget Limits per Category or Group, scoped to the Household
- Expense history view with filtering by date range, category, and group
- Real-time remaining balance per Budget Limit

### Out of Scope
- Bill splitting or shared expenses (each expense belongs to exactly one user)
- Native mobile apps (web browser only)
- Multi-currency (single currency throughout — future scope)
- Forecasting, analytics, and grouped views (future scope)

---

## Bounded Contexts

### Identity
Manages users and their grouping into households.

**Aggregates:**

**`Household`** — Aggregate Root, Entity
A group of one or more users who share a Catalogue, Budget Limits, and a view of all Expenses.
_Avoid_: "team," "account," "family."

**`User`** — Aggregate Root, Entity
One person using the app. May belong to at most one Household, referenced by `HouseholdId`. A User can exist without a Household (e.g., immediately after registration, before creating or joining one).
_Avoid_: "account" (use User).

**Use Cases:**
- `CreateUser` — register a new user (no Household required at this point)
- `CreateHousehold` — create a new Household; the creating User becomes its first member
- `JoinHousehold` — associate an existing User with an existing Household

---

### Catalogue
Manages the taxonomy of expense types. Reference data scoped to a Household that changes infrequently.

**Aggregates:**

**`Group`** — Aggregate Root, Entity
The broad bucket that Categories belong to (e.g., "Fixed Expenses," "Non-Primary Expenses"). Scoped to a Household via `HouseholdId`.
_Avoid_: "Super Type," "super category."

**`Category`** — Aggregate Root, Entity
The specific type of an expense (e.g., "Car," "Food," "Entertainment"). Always belongs to one Group, referenced by `GroupId`. Scoped to a Household via `HouseholdId`. Supports soft-delete: a deleted Category no longer appears for new Expenses but remains valid on existing ones.
_Avoid_: "Type," "expense type," "tag."

**Use Cases:**
- `CreateGroup` — add a new Group to the Household's Catalogue
- `RenameGroup` — change a Group's name
- `SoftDeleteGroup` — mark a Group as deleted; it disappears from new-expense selection but existing references are preserved
- `CreateCategory` — add a new Category under a Group
- `RenameCategory` — change a Category's name
- `MoveCategory` — reassign a Category to a different Group within the same Household
- `SoftDeleteCategory` — mark a Category as deleted; same soft-delete semantics as Group
- `ListGroups` — return all active Groups for the Household (used when logging a new Expense)
- `ListCategories` — return all active Categories for a given Group (used when logging a new Expense)

---

### Expense
The core domain context. Covers logging and querying individual expenses within a Household, and managing the payment instruments a user can pay with.

**Aggregates:**

**`Expense`** — Aggregate Root, Entity
A single purchase logged by one user. The atomic unit of this domain. Belongs to a Household; the logging user is recorded but the Expense is not private to them.
_Avoid_: "transaction," "charge," "record."

**`PaymentInstrument`** — Aggregate Root, Entity
A saved credit card or bank account belonging to a specific User. Used to record how an Expense was paid and to filter Expenses by payment source. Supports soft-delete: a deleted instrument no longer appears when logging a new Expense but remains resolvable on existing ones.
_Avoid_: "card," "account" (use PaymentInstrument).

**Value Objects on `Expense`:**

- **`Money`** — The amount of the expense, composed of a numeric amount and a `Currency`.
  _Avoid_: "amount" used alone as a domain term (use `Money` in code).

- **`Currency`** — The denomination of a `Money` value. Represented as an ISO 4217 code (e.g., `ARS`). Only `ARS` is supported in the initial build; new currencies are added by extending this type without changing `Money` or any other VO.
  _Avoid_: "currency code," "currency type."

- **`PaymentMethod`** — How the expense was paid. A discriminated union: either `Cash` (no instrument) or a reference to a `PaymentInstrumentId`.
  _Avoid_: "payment type."

- **`InstallmentPlan`** — The number of monthly payments a credit card expense is split into.
  Present only when the referenced `PaymentInstrument.type` is `CreditCard`. Absent for Cash and BankAccount payments.
  _Avoid_: "quotes," "cuotas," "fees."

- **`ExpenseDate`** — The date the purchase occurred (not the date it was logged).

**Value Objects on `PaymentInstrument`:**

- **`PaymentInstrumentType`** — Enum: `CreditCard`, `BankAccount`.

**References on `Expense`:** `HouseholdId`, `UserId`, `CategoryId`, and either nothing (Cash) or `PaymentInstrumentId`.
**References on `PaymentInstrument`:** `UserId`.

**Use Cases:**
- `LogExpense` — record a new Expense for the current user within the Household
- `DeleteExpense` — permanently remove an Expense
- `ListExpenses` — return Expenses for a Household, filterable by date range, Category, Group, and PaymentInstrument
- `CreatePaymentInstrument` — save a new credit card or bank account for the current user
- `RenamePaymentInstrument` — change the name of a saved instrument
- `SoftDeletePaymentInstrument` — mark an instrument as deleted; it disappears from new-expense selection but remains resolvable on existing Expenses
- `ListPaymentInstruments` — return all active instruments belonging to the current user

---

### Budget
Manages spending caps and remaining balances. Scoped to a Household; consumes expense data from the Expense context.

**Aggregates:**

**`BudgetLimit`** — Aggregate Root, Entity
A spending cap set on either a Category or a Group (never both) within a Household. Tracks remaining balance within a configurable period against all Expenses in the Household.
_Avoid_: "budget" (too vague), "spending rule."

**Value Objects on `BudgetLimit`:**

- **`Money`** — The cap amount (the maximum allowed spending). Must use the same `Currency` as the Expenses being evaluated.

- **`BudgetPeriod`** — The time window for evaluating spending against the cap.
  Variants: `Monthly` (resets on the 1st of each calendar month), `Rolling30Days`, `Custom` (explicit date range).
  _Avoid_: "timeframe," "window."

**References on `BudgetLimit`:** `HouseholdId`, and either `CategoryId` OR `GroupId` (exclusive — never both).

**Use Cases:**
- `CreateBudgetLimit` — define a new spending cap for the Household
- `EditBudgetLimit` — change the cap amount or period of an existing BudgetLimit
- `DeleteBudgetLimit` — remove a BudgetLimit
- `GetBudgetLimitBalance` — return the remaining balance for a specific BudgetLimit within its active period
- `ListBudgetLimits` — return all BudgetLimits for a Household

---

## Business Rules / Invariants

- A `Household` has one or more `Users`.
- A `User` may belong to at most one `Household`. A `User` can exist without a `Household`, but cannot perform any domain action (log expenses, manage the Catalogue, view Budget Limits) until they belong to one.
- An `Expense` is owned by exactly one `User` but belongs to the `Household`. All household members can view it.
- `InstallmentPlan` MUST be present if and only if the referenced `PaymentInstrument.type` is `CreditCard`. Cash and BankAccount payments never have an `InstallmentPlan`.
- A `PaymentInstrument` belongs to exactly one `User`.
- A soft-deleted `PaymentInstrument` MUST NOT appear as a selectable option when logging a new Expense, but MUST remain resolvable for existing Expenses that reference it.
- A `Category` belongs to exactly one `Group`. Reassigning it changes the `GroupId` reference on the Category aggregate.
- `Group` and `Category` are scoped to a `Household`. A `HouseholdId` is always required.
- A soft-deleted `Group` or `Category` MUST NOT appear as a selectable option when logging a new Expense, but MUST remain resolvable for existing Expenses that reference it.
- A `BudgetLimit` targets either a `CategoryId` or a `GroupId` — never both, never neither.
- A `BudgetLimit` is scoped to a `Household`.
- Only `Currency.ARS` is supported in the initial build. All `Money` values are in the same currency for budget balance calculations to be valid.
- A `BudgetLimit`'s remaining balance = cap `Money` minus the sum of all `Expense.Money` values in the Household whose `CategoryId` (or whose Category's `GroupId`) matches the limit's target, within the active `BudgetPeriod`.

---

## Key Decisions

### Household as the sharing unit
Expenses, the Catalogue, and Budget Limits are all scoped to a Household — not to individual users. A User is recorded on each Expense to show who logged it, but the Expense belongs to the Household and is visible to all members. A User can exist before joining or creating a Household.

### Currency is a first-class VO, only ARS supported initially
`Currency` is modeled as its own value object (ISO 4217 code) inside `Money`, so adding a new currency in the future means extending `Currency` only — no changes to `Money`, `Expense`, or any other type. Multi-currency budget balance calculations (which require exchange rate decisions) remain deferred to future scope.

### Budget Limit period is per-limit, not global
Each `BudgetLimit` configures its own `BudgetPeriod`. This allows mixing monthly limits (e.g., food) with rolling limits (e.g., entertainment) without a global setting that would force one model on all limits.

### Expenses are append-only except for deletion
Expenses can be deleted but not edited. This preserves the integrity of historical spending data and simplifies the audit trail.

### Soft-delete for Catalogue items
Groups and Categories are soft-deleted rather than hard-deleted. This preserves referential integrity on historical Expenses while keeping the active Catalogue clean for new entries.

---

## Open Questions
- None at this time.
