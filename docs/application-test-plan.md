# Application Test Plan

## Identity / CreateUser

- [ ] persists a new user and returns its id

## Identity / CreateHousehold

- [ ] persists a new household with the creator as its first member and returns its id
- [ ] throws when the creator user does not exist

## Identity / JoinHousehold

- [ ] adds the user to the household and persists both aggregates
- [ ] throws when the user does not exist
- [ ] throws when the household does not exist

## Catalogue / CreateGroup

- [ ] persists a new group and returns its id

## Catalogue / RenameGroup

- [ ] renames the group and persists the updated aggregate
- [ ] throws when the group does not exist

## Catalogue / SoftDeleteGroup

- [ ] marks the group as deleted and persists the updated aggregate
- [ ] throws when the group does not exist

## Catalogue / ListGroups

- [ ] returns only active groups for the household

## Catalogue / CreateCategory

- [ ] persists a new category under the given group and returns its id
- [ ] throws when the group does not exist

## Catalogue / RenameCategory

- [ ] renames the category and persists the updated aggregate
- [ ] throws when the category does not exist

## Catalogue / MoveCategory

- [ ] moves the category to the target group and persists the updated aggregate
- [ ] throws when the category does not exist
- [ ] throws when the target group does not exist

## Catalogue / SoftDeleteCategory

- [ ] marks the category as deleted and persists the updated aggregate
- [ ] throws when the category does not exist

## Catalogue / ListCategories

- [ ] returns only active categories for the given group

## Expense / CreatePaymentInstrument

- [ ] persists a new payment instrument and returns its id

## Expense / RenamePaymentInstrument

- [ ] renames the instrument and persists the updated aggregate
- [ ] throws when the instrument does not exist

## Expense / SoftDeletePaymentInstrument

- [ ] marks the instrument as deleted and persists the updated aggregate
- [ ] throws when the instrument does not exist

## Expense / ListPaymentInstruments

- [ ] returns only active instruments for the given user

## Expense / LogExpense

- [ ] persists a cash expense and returns its id
- [ ] persists a bank-account expense and returns its id
- [ ] persists a credit-card expense with an installment plan and returns its id
- [ ] throws when the category does not exist
- [ ] throws when a credit-card payment references an instrument that does not exist
- [ ] throws when a credit-card payment references an instrument that is not of type CreditCard

## Expense / DeleteExpense

- [ ] deletes the expense from the repository
- [ ] throws when the expense does not exist

## Expense / ListExpenses

- [ ] returns a paginated page of expenses for the household
- [ ] filters expenses by category id
- [ ] filters expenses by payment instrument id
- [ ] filters expenses by date range
- [ ] resolves a groupId filter to its category ids and returns only matching expenses

## Budget / CreateBudgetLimit

- [ ] persists a category-scoped budget limit and returns its id
- [ ] persists a group-scoped budget limit and returns its id

## Budget / EditBudgetLimit

- [ ] updates the money and period of the limit and persists the updated aggregate
- [ ] throws when the budget limit does not exist

## Budget / DeleteBudgetLimit

- [ ] deletes the budget limit from the repository
- [ ] throws when the budget limit does not exist

## Budget / ListBudgetLimits

- [ ] returns all budget limits for the household

## Budget / GetBudgetLimitBalance

- [ ] returns the full cap as remaining when there are no expenses in the period
- [ ] returns remaining balance after subtracting expenses matching the category-scoped limit
- [ ] returns remaining balance after subtracting expenses matching the group-scoped limit (resolves group to categories)
- [ ] throws when the budget limit does not exist
