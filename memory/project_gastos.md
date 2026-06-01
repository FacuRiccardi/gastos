---
name: project-gastos
description: Core architecture decisions, bounded contexts, and implementation state for the Gastos project
metadata:
  type: project
---

Gastos is a household expense-tracking web app (TypeScript + Fastify + Vitest). Domain layer implemented following DDD with strict TDD.

**Domain layer status (as of 2026-05-31):** Complete. 77 tests, 0 failures across 12 test files.

Bounded contexts implemented:
- **Identity:** Household (aggregate), User (aggregate), HouseholdId, UserId
- **Catalogue:** Group (aggregate, soft-delete), Category (aggregate, soft-delete + moveTo), GroupId, CategoryId
- **Expense:** Expense (aggregate, CreditCard/InstallmentPlan invariant), PaymentInstrument (aggregate, soft-delete), InstallmentPlan (VO), ExpenseDate (VO), PaymentMethod (discriminated union: Cash/CreditCard/BankAccount), ExpenseId, PaymentInstrumentId, PaymentInstrumentType (enum)
- **Budget:** BudgetLimit (aggregate, static factories forCategory/forGroup), BudgetPeriod (VO, Monthly/Rolling30Days/Custom), BudgetLimitId
- **Shared:** Money (VO, positive-only), Currency (VO, ARS only via from())

**Key design decisions:**
- All IDs are branded string types with `generate()` and `from()` statics (no class, just a type + object)
- All aggregates are immutable: operations return new instances
- Soft-delete via optional `deletedAt?: Date` field, `isDeleted` getter
- BudgetLimit uses static factories (`forCategory`, `forGroup`) to enforce the exclusive target invariant
- PaymentMethod discriminated union carries kind (Cash/CreditCard/BankAccount), enabling Expense to enforce InstallmentPlan invariant at construction time

**Why:** Domain enforces all invariants at construction time — no runtime null-guards needed. Tests cover only domain-rule violations, not TypeScript type-system boundaries.

**How to apply:** Next step is application layer (use cases) and repository interfaces. Domain layer should not change unless domain rules change.
