# Domain Test Plan

## Shared / Currency

- [ ] `Currency.from('ARS')` constructs successfully
- [ ] `Currency.from('USD')` throws for an unsupported currency code
- [ ] Two Currency values with the same code are equal

## Shared / Money

- [ ] Constructs with a positive amount and a valid Currency
- [ ] Rejects a zero amount
- [ ] Rejects a negative amount
- [ ] Two Money instances with the same amount and currency are equal
- [ ] Two Money instances with different amounts are not equal
- [ ] Two Money instances with different currencies are not equal

## Identity / Household

- [ ] Constructs with a valid id, name, and at least one member
- [ ] Rejects an empty name on construction
- [ ] `rename()` returns a new Household with the updated name
- [ ] `rename()` with an empty string throws
- [ ] `rename()` leaves the original unchanged
- [ ] `addMember()` returns a new Household with the additional member
- [ ] `addMember()` leaves the original unchanged

## Identity / User

- [ ] Constructs with a valid UserId and name (no Household)
- [ ] A newly created User has no Household
- [ ] `joinHousehold()` returns a new User with the HouseholdId set
- [ ] `joinHousehold()` leaves the original unchanged
- [ ] `joinHousehold()` throws when the User already belongs to a Household

## Catalogue / Group

- [ ] Constructs with a valid id, householdId, and name
- [ ] Rejects an empty name on construction
- [ ] `rename()` returns a new Group with the updated name
- [ ] `rename()` with an empty string throws
- [ ] `rename()` leaves the original unchanged
- [ ] `softDelete()` returns a new Group marked as deleted
- [ ] `softDelete()` leaves the original unchanged
- [ ] `isDeleted` is false for a non-deleted Group
- [ ] `isDeleted` is true after soft delete

## Catalogue / Category

- [ ] Constructs with a valid id, householdId, groupId, and name
- [ ] Rejects an empty name on construction
- [ ] `rename()` returns a new Category with the updated name
- [ ] `rename()` with an empty string throws
- [ ] `rename()` leaves the original unchanged
- [ ] `moveTo()` returns a new Category with the new GroupId
- [ ] `moveTo()` leaves the original unchanged
- [ ] `softDelete()` returns a new Category marked as deleted
- [ ] `softDelete()` leaves the original unchanged
- [ ] `isDeleted` is false for a non-deleted Category
- [ ] `isDeleted` is true after soft delete

## Expense / InstallmentPlan

- [ ] Constructs with a valid positive integer count
- [ ] Rejects a zero count
- [ ] Rejects a negative count
- [ ] Rejects a fractional count (e.g., 1.5)
- [ ] Two InstallmentPlans with the same count are equal
- [ ] Two InstallmentPlans with different counts are not equal

## Expense / ExpenseDate

- [ ] Constructs from a valid Date
- [ ] Two ExpenseDates representing the same day are equal
- [ ] Two ExpenseDates on different days are not equal

## Expense / Expense

- [ ] Constructs with Cash payment and no InstallmentPlan
- [ ] Constructs with CreditCard payment and an InstallmentPlan
- [ ] Constructs with BankAccount payment and no InstallmentPlan
- [ ] Rejects a CreditCard payment without an InstallmentPlan
- [ ] Rejects a Cash payment with an InstallmentPlan
- [ ] Rejects a BankAccount payment with an InstallmentPlan

## Expense / PaymentInstrument

- [ ] Constructs with a valid id, userId, CreditCard type, and name
- [ ] Constructs with a valid id, userId, BankAccount type, and name
- [ ] Rejects an empty name on construction
- [ ] `rename()` returns a new PaymentInstrument with the updated name
- [ ] `rename()` with an empty string throws
- [ ] `rename()` leaves the original unchanged
- [ ] `softDelete()` returns a new PaymentInstrument marked as deleted
- [ ] `softDelete()` leaves the original unchanged
- [ ] `isDeleted` is false for a non-deleted instrument
- [ ] `isDeleted` is true after soft delete

## Budget / BudgetPeriod

- [ ] `BudgetPeriod.monthly()` constructs a Monthly period
- [ ] `BudgetPeriod.rolling30Days()` constructs a Rolling30Days period
- [ ] `BudgetPeriod.custom(start, end)` constructs a Custom period with valid dates
- [ ] Custom period rejects an end date before the start date
- [ ] Two Monthly periods are equal
- [ ] A Monthly period and a Rolling30Days period are not equal

## Budget / BudgetLimit

- [ ] `BudgetLimit.forCategory()` creates a limit with categoryId set and groupId absent
- [ ] `BudgetLimit.forGroup()` creates a limit with groupId set and categoryId absent
- [ ] `edit()` returns a new BudgetLimit with the updated Money
- [ ] `edit()` returns a new BudgetLimit with the updated BudgetPeriod
- [ ] `edit()` leaves the original unchanged
