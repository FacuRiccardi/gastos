# Repository Plan

## HouseholdRepository
File: `identity/household/HouseholdRepository.ts`

Methods:
- `findById(id: HouseholdId): Promise<Household | null>`
- `save(household: Household): Promise<void>`

Notes: No soft-delete. `JoinHousehold` loads via `findById` then persists via `save`.

---

## UserRepository
File: `identity/user/UserRepository.ts`

Methods:
- `findById(id: UserId): Promise<User | null>`
- `save(user: User): Promise<void>`

Notes: No soft-delete. `JoinHousehold` loads the User via `findById` then persists the updated instance via `save`.

---

## GroupRepository
File: `catalogue/group/GroupRepository.ts`

Methods:
- `findById(id: GroupId): Promise<Group | null>`
- `findActiveByHousehold(householdId: HouseholdId): Promise<Group[]>`
- `save(group: Group): Promise<void>`

Notes: Soft-deletable. `findById` resolves all groups including deleted ones (existing references must remain valid). `findActiveByHousehold` returns only non-deleted groups (used by `ListGroups` when logging a new expense). Groups per household are reference data — inherently small, no pagination.

---

## CategoryRepository
File: `catalogue/category/CategoryRepository.ts`

Methods:
- `findById(id: CategoryId): Promise<Category | null>`
- `findActiveByGroup(groupId: GroupId): Promise<Category[]>`
- `save(category: Category): Promise<void>`

Notes: Soft-deletable. Same semantics as GroupRepository. `findActiveByGroup` returns only non-deleted categories for a given group. Categories per group are reference data — no pagination.

---

## ExpenseRepository
File: `expense/ExpenseRepository.ts`

Methods:
- `findById(id: ExpenseId): Promise<Expense | null>`
- `findByHousehold(householdId: HouseholdId, filters: ExpenseFilters, pagination: Pagination): Promise<Page<Expense>>`
- `save(expense: Expense): Promise<void>`
- `delete(id: ExpenseId): Promise<void>`

Notes: Hard delete only (expenses are append-only per DOMAIN.md; `DeleteExpense` permanently removes). `ListExpenses` is unbounded (grows with user activity) — requires `Pagination` and returns `Page<Expense>`. Multiple filter criteria (date range, category, group, payment instrument) → use `ExpenseFilters` type (already planned in TECH_DOMAIN.md at `expense/ExpenseFilters.ts`).

`ExpenseFilters` shape:
```typescript
export class ExpenseFilters {
  constructor(
    readonly from?: ExpenseDate,
    readonly to?: ExpenseDate,
    readonly categoryId?: CategoryId,
    readonly groupId?: GroupId,
    readonly paymentInstrumentId?: PaymentInstrumentId,
  ) {}
}
```

---

## PaymentInstrumentRepository
File: `expense/payment-instrument/PaymentInstrumentRepository.ts`

Methods:
- `findById(id: PaymentInstrumentId): Promise<PaymentInstrument | null>`
- `findActiveByUser(userId: UserId): Promise<PaymentInstrument[]>`
- `save(instrument: PaymentInstrument): Promise<void>`

Notes: Soft-deletable. `findById` resolves all instruments including deleted ones (existing expense references must remain valid). `findActiveByUser` returns only non-deleted instruments (used by `ListPaymentInstruments`). Payment instruments per user are reference data — no pagination.

---

## BudgetLimitRepository
File: `budget/BudgetLimitRepository.ts`

Methods:
- `findById(id: BudgetLimitId): Promise<BudgetLimit | null>`
- `findByHousehold(householdId: HouseholdId): Promise<BudgetLimit[]>`
- `save(limit: BudgetLimit): Promise<void>`
- `delete(id: BudgetLimitId): Promise<void>`

Notes: Hard delete (`DeleteBudgetLimit` use case removes permanently). `findByHousehold` returns all limits for a household — small and bounded, no pagination. `GetBudgetLimitBalance` uses `findById` to load the limit before computing the balance.
