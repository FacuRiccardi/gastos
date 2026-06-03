# Gastos — Technical Domain Map

Maps every concept in `DOMAIN.md` to its concrete code location, class type, and design pattern.

---

## Infrastructure Decisions

| Concern | Choice | Notes |
|---|---|---|
| Backend runtime | Node.js + Fastify | Already in place |
| Database | PostgreSQL | Hosted on Railway |
| Backend hosting | Railway | Includes Postgres, deploys from GitHub |
| Frontend hosting | Vercel | React SPA, free tier |
| ORM / query layer | Drizzle | TypeScript-first, lightweight, handles migrations |

---

## Layer Overview

```
src/
  domain/         ← pure business logic (this document)
  application/    ← use case orchestration (calls domain, drives ports)
  infrastructure/ ← repository implementations, DB, external services
  http/           ← HTTP adapters (Fastify routes/controllers)

tests/
  unit/
    domain/       ← mirrors src/domain/ folder-for-folder
    application/  ← mirrors src/application/ folder-for-folder
  helpers/        ← in-memory repository implementations shared across application tests
  integration/    ← tests that span infrastructure adapters
```

The domain layer has **zero** dependencies on application, infrastructure, or http. It knows nothing about databases, HTTP, or frameworks.

---

## Folder Structure — `src/domain/`

```
src/domain/
  shared/
    Money.ts
    Currency.ts
    Pagination.ts
    Page.ts

  identity/
    household/
      Household.ts
      HouseholdId.ts
      HouseholdRepository.ts
    user/
      User.ts
      UserId.ts
      UserRepository.ts

  catalogue/
    group/
      Group.ts
      GroupId.ts
      GroupRepository.ts
    category/
      Category.ts
      CategoryId.ts
      CategoryRepository.ts

  expense/
    Expense.ts
    ExpenseId.ts
    PaymentMethod.ts
    InstallmentPlan.ts
    ExpenseDate.ts
    ExpenseFilters.ts
    ExpenseRepository.ts
    payment-instrument/
      PaymentInstrument.ts
      PaymentInstrumentId.ts
      PaymentInstrumentType.ts
      PaymentInstrumentRepository.ts

  budget/
    BudgetLimit.ts
    BudgetLimitId.ts
    BudgetPeriod.ts
    BudgetLimitRepository.ts
```

---

## Folder Structure — `src/application/`

One class per use case, organized by bounded context. Each file exports the use case class, its input type, and its output type.

```
src/application/
  identity/
    CreateUser.ts
    CreateHousehold.ts
    JoinHousehold.ts
  catalogue/
    CreateGroup.ts
    RenameGroup.ts
    SoftDeleteGroup.ts
    ListGroups.ts
    CreateCategory.ts
    RenameCategory.ts
    MoveCategory.ts
    SoftDeleteCategory.ts
    ListCategories.ts
  expense/
    LogExpense.ts
    DeleteExpense.ts
    ListExpenses.ts
    payment-instrument/
      CreatePaymentInstrument.ts
      RenamePaymentInstrument.ts
      SoftDeletePaymentInstrument.ts
      ListPaymentInstruments.ts
  budget/
    CreateBudgetLimit.ts
    EditBudgetLimit.ts
    DeleteBudgetLimit.ts
    GetBudgetLimitBalance.ts
    ListBudgetLimits.ts
```

### Use Case Shape

Every use case follows this pattern:

```typescript
export interface LogExpenseInput {
  householdId: HouseholdId;
  userId: UserId;
  // ... all required inputs using domain types
}

export type LogExpenseOutput = { id: ExpenseId };

export class LogExpense {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: LogExpenseInput): Promise<LogExpenseOutput> {
    // 1. load / validate via repositories
    // 2. call domain methods
    // 3. persist via repositories
    // 4. return output
  }
}
```

**Rules:**
- Input and output types use domain types (branded IDs, VOs) — no raw strings
- The constructor declares only the repository interfaces it actually needs
- `execute()` is always `async` and returns a `Promise`
- Use cases do not call other use cases — they call repositories and domain methods directly
- Cross-context queries (e.g. resolving GroupId → CategoryIds for ListExpenses) are orchestrated here

---

## Folder Structure — `tests/unit/application/`

Mirrors `src/application/`. Each use case has one test file.

```
tests/unit/application/
  identity/
    CreateUser.test.ts
    CreateHousehold.test.ts
    JoinHousehold.test.ts
  catalogue/
    CreateGroup.test.ts
    RenameGroup.test.ts
    SoftDeleteGroup.test.ts
    ListGroups.test.ts
    CreateCategory.test.ts
    RenameCategory.test.ts
    MoveCategory.test.ts
    SoftDeleteCategory.test.ts
    ListCategories.test.ts
  expense/
    LogExpense.test.ts
    DeleteExpense.test.ts
    ListExpenses.test.ts
    payment-instrument/
      CreatePaymentInstrument.test.ts
      RenamePaymentInstrument.test.ts
      SoftDeletePaymentInstrument.test.ts
      ListPaymentInstruments.test.ts
  budget/
    CreateBudgetLimit.test.ts
    EditBudgetLimit.test.ts
    DeleteBudgetLimit.test.ts
    GetBudgetLimitBalance.test.ts
    ListBudgetLimits.test.ts
```

### In-Memory Repositories

Application tests never hit a real database. Each repository interface has an in-memory implementation in `tests/helpers/`, shared across all use case tests.

```
tests/helpers/
  InMemoryHouseholdRepository.ts
  InMemoryUserRepository.ts
  InMemoryGroupRepository.ts
  InMemoryCategoryRepository.ts
  InMemoryExpenseRepository.ts
  InMemoryPaymentInstrumentRepository.ts
  InMemoryBudgetLimitRepository.ts
```

Each in-memory implementation stores aggregates in a plain `Map` and implements the full repository interface. They are the only place in the test suite that holds mutable state.

---

## Folder Structure — `tests/unit/domain/`

Mirrors `src/domain/` exactly. Each file under `src/domain/` that contains non-trivial logic has a corresponding `.test.ts` file.

```
tests/unit/domain/
  shared/
    Money.test.ts
    Currency.test.ts

  identity/
    household/
      Household.test.ts
    user/
      User.test.ts

  catalogue/
    group/
      Group.test.ts
    category/
      Category.test.ts

  expense/
    Expense.test.ts
    InstallmentPlan.test.ts
    ExpenseDate.test.ts
    payment-instrument/
      PaymentInstrument.test.ts

  budget/
    BudgetLimit.test.ts
    BudgetPeriod.test.ts
```

---

## Design Patterns Used in the Domain

### Value Object
**Where:** every file not named an Aggregate Root or Repository.
**Rule:** immutable; equality is by value, not reference; no identity field.
**Examples:** `Money`, `Currency`, `PaymentMethod`, `InstallmentPlan`, `ExpenseDate`, `BudgetPeriod`, all `*Id` types.

### Repository (Port)
**Where:** one `*Repository.ts` interface per Aggregate Root, inside the aggregate's folder.
**Rule:** the interface lives in the domain; the implementation lives in `infrastructure/`. The domain only ever depends on the interface.
**Examples:** `HouseholdRepository`, `ExpenseRepository`, `BudgetLimitRepository`.

### Static Factory Method
**Where:** `BudgetLimit.ts`.
**Why:** `BudgetLimit` must target either a `CategoryId` or a `GroupId` — never both, never neither. Constructing it directly would require external validation. Two static factories make each valid state explicit and unconstruable the wrong way.
```
BudgetLimit.forCategory(id, householdId, money, period)
BudgetLimit.forGroup(id, householdId, money, period)
```

---

## Concept-to-Code Table

| Domain Concept | File | Kind | Pattern |
|---|---|---|---|
| `Household` | `identity/household/Household.ts` | class (AR) | — |
| `HouseholdId` | `identity/household/HouseholdId.ts` | class | Value Object |
| `HouseholdRepository` | `identity/household/HouseholdRepository.ts` | interface | Repository (Port) |
| `User` | `identity/user/User.ts` | class (AR) | — |
| `UserId` | `identity/user/UserId.ts` | class | Value Object |
| `UserRepository` | `identity/user/UserRepository.ts` | interface | Repository (Port) |
| `Group` | `catalogue/group/Group.ts` | class (AR) | — |
| `GroupId` | `catalogue/group/GroupId.ts` | class | Value Object |
| `GroupRepository` | `catalogue/group/GroupRepository.ts` | interface | Repository (Port) |
| `Category` | `catalogue/category/Category.ts` | class (AR) | — |
| `CategoryId` | `catalogue/category/CategoryId.ts` | class | Value Object |
| `CategoryRepository` | `catalogue/category/CategoryRepository.ts` | interface | Repository (Port) |
| `Expense` | `expense/Expense.ts` | class (AR) | — |
| `ExpenseId` | `expense/ExpenseId.ts` | class | Value Object |
| `Money` | `shared/Money.ts` | class | Value Object |
| `Currency` | `shared/Currency.ts` | enum + VO wrapper | Value Object |
| `Pagination` | `shared/Pagination.ts` | class | Value Object (limit + offset for paginated queries) |
| `Page<T>` | `shared/Page.ts` | class | Value Object (items + total for paginated results) |
| `PaymentMethod` | `expense/PaymentMethod.ts` | discriminated union | Value Object |
| `InstallmentPlan` | `expense/InstallmentPlan.ts` | class | Value Object |
| `ExpenseDate` | `expense/ExpenseDate.ts` | class | Value Object |
| `ExpenseFilters` | `expense/ExpenseFilters.ts` | class | Value Object (query params for `ListExpenses`) |
| `ExpenseRepository` | `expense/ExpenseRepository.ts` | interface | Repository (Port) |
| `PaymentInstrument` | `expense/payment-instrument/PaymentInstrument.ts` | class (AR) | — |
| `PaymentInstrumentId` | `expense/payment-instrument/PaymentInstrumentId.ts` | branded type | Value Object |
| `PaymentInstrumentType` | `expense/payment-instrument/PaymentInstrumentType.ts` | enum | Value Object |
| `PaymentInstrumentRepository` | `expense/payment-instrument/PaymentInstrumentRepository.ts` | interface | Repository (Port) |
| `BudgetLimit` | `budget/BudgetLimit.ts` | class (AR) | Static Factory Method |
| `BudgetLimitId` | `budget/BudgetLimitId.ts` | class | Value Object |
| `BudgetPeriod` | `budget/BudgetPeriod.ts` | class | Value Object |
| `BudgetLimitRepository` | `budget/BudgetLimitRepository.ts` | interface | Repository (Port) |

---

## Conventions

- **Aggregate Root (AR):** the only entry point into its consistency boundary. External code holds a reference to the AR, never to internal entities directly.
- **Immutability:** Value Objects are constructed once and never mutated. Methods that "change" a VO return a new instance.
- **No infrastructure imports:** nothing inside `src/domain/` may import from `src/application/`, `src/infrastructure/`, or `src/http/`.
- **Errors:** each context defines its own domain error classes colocated with the aggregate (e.g., `catalogue/group/GroupNotFoundError.ts`). No generic error wrappers.
- **IDs:** every `*Id` is a branded type wrapping a `string` UUID. Branding makes them nominally distinct so TypeScript rejects a `UserId` where a `HouseholdId` is expected. Each `*Id` file also exposes a `generate()` static method that calls `crypto.randomUUID()` internally. IDs are never bare primitives in domain signatures.
