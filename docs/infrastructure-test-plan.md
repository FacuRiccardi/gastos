# Infrastructure Test Plan

## HouseholdRepository

- [ ] saves and retrieves a Household with all fields intact (id, name, members)
- [ ] returns null for an unknown HouseholdId
- [ ] save() with an existing id overwrites the previous state (rename)
- [ ] saves a Household with multiple members and retrieves them all
- [ ] adding a member via save() persists the new member list

## UserRepository

- [ ] saves and retrieves a User with all fields intact (id, name, no household)
- [ ] returns null for an unknown UserId
- [ ] save() with an existing id overwrites the previous state
- [ ] reconstructs User.householdId from household_members (User joined a Household)
- [ ] reconstructs User with no householdId when the User has not joined any Household

## GroupRepository

- [ ] saves and retrieves an active Group with all fields intact
- [ ] returns null for an unknown GroupId
- [ ] save() with an existing id overwrites the previous state (rename)
- [ ] findActiveByHousehold() excludes soft-deleted Groups
- [ ] findActiveByHousehold() returns only Groups belonging to the given Household
- [ ] findById() resolves a soft-deleted Group
- [ ] save() persists a soft-deleted Group (deleted_at is stored)

## CategoryRepository

- [ ] saves and retrieves an active Category with all fields intact
- [ ] returns null for an unknown CategoryId
- [ ] save() with an existing id overwrites the previous state (rename, move)
- [ ] findActiveByGroup() excludes soft-deleted Categories
- [ ] findActiveByGroup() returns only Categories belonging to the given Group
- [ ] findById() resolves a soft-deleted Category
- [ ] findAllByGroup() returns both active and soft-deleted Categories for the Group
- [ ] save() persists a soft-deleted Category (deleted_at is stored)

## PaymentInstrumentRepository

- [ ] saves and retrieves an active PaymentInstrument with all fields intact
- [ ] returns null for an unknown PaymentInstrumentId
- [ ] save() with an existing id overwrites the previous state (rename)
- [ ] findActiveByUser() excludes soft-deleted instruments
- [ ] findActiveByUser() returns only instruments belonging to the given User
- [ ] findById() resolves a soft-deleted PaymentInstrument
- [ ] save() persists a soft-deleted PaymentInstrument (deleted_at is stored)
- [ ] reconstructs the PaymentInstrumentType enum correctly (CreditCard and BankAccount)

## ExpenseRepository

- [ ] saves and retrieves a Cash Expense with all fields intact
- [ ] saves and retrieves a CreditCard Expense with PaymentInstrumentId and InstallmentPlan
- [ ] saves and retrieves a BankAccount Expense with PaymentInstrumentId (no InstallmentPlan)
- [ ] returns null for an unknown ExpenseId
- [ ] delete() removes the Expense; findById() returns null afterwards
- [ ] save() with an existing id overwrites the previous state
- [ ] findByHousehold() returns only Expenses for the given Household
- [ ] findByHousehold() filters by date range (from / to)
- [ ] findByHousehold() filters by categoryId
- [ ] findByHousehold() filters by paymentInstrumentId
- [ ] findByHousehold() paginates correctly (limit, offset, total count)
- [ ] sumAmountByHousehold() returns the correct total for a filtered set
- [ ] reconstructs the ExpenseDate value object correctly
- [ ] reconstructs the Money value object (amount as number, Currency from code)

## BudgetLimitRepository

- [ ] saves and retrieves a BudgetLimit targeting a Category (Monthly period)
- [ ] saves and retrieves a BudgetLimit targeting a Group (Rolling30Days period)
- [ ] saves and retrieves a BudgetLimit with a Custom period (start and end dates)
- [ ] returns null for an unknown BudgetLimitId
- [ ] delete() removes the BudgetLimit; findById() returns null afterwards
- [ ] save() with an existing id overwrites the previous state
- [ ] findByHousehold() returns only BudgetLimits for the given Household
- [ ] reconstructs BudgetLimit.forCategory() correctly (categoryId set, groupId null)
- [ ] reconstructs BudgetLimit.forGroup() correctly (groupId set, categoryId null)
