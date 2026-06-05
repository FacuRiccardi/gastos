# HTTP Test Plan

24 endpoints × (1 unit happy path + additional unit cases + 1 E2E wiring test).
E2E tests own wiring only — one happy path per endpoint. Domain/use-case logic is covered by lower layers.

---

## Identity / POST /api/users

**Unit:** returns 201 with `{ id: string }` for valid `{ name }` body
**E2E:** creates a user and a subsequent `POST /api/households` with that user id succeeds (proves DB persistence)

Additional unit cases:
- [ ] returns 400 when `name` is missing from body

---

## Identity / POST /api/households

**Unit:** returns 201 with `{ id: string }` for valid body + X-User-Id header
**E2E:** seeds a user, creates a household, then `GET /api/groups` with that household id returns 200 with empty list

Additional unit cases:
- [ ] returns 400 when X-User-Id header is missing
- [ ] returns 400 when X-User-Id is not a valid UUID
- [ ] returns 400 when `name` is missing from body
- [ ] returns 404 when user does not exist

---

## Identity / POST /api/households/:id/members

**Unit:** returns 204 when user and household both exist
**E2E:** seeds a user and a household, posts join, expects 204

Additional unit cases:
- [ ] returns 400 when X-User-Id header is missing
- [ ] returns 404 when household is not found
- [ ] returns 404 when user is not found
- [ ] returns 422 when user is already a member (DomainError → 422)

---

## Catalogue / POST /api/groups

**Unit:** returns 201 with `{ id: string }` for valid body + headers
**E2E:** creates a group and `GET /api/groups` returns it in the list

Additional unit cases:
- [ ] returns 400 when X-User-Id is missing
- [ ] returns 400 when X-Household-Id is missing
- [ ] returns 400 when `name` is missing from body

---

## Catalogue / PATCH /api/groups/:id/name

**Unit:** returns 204 for valid request
**E2E:** renames a group and `GET /api/groups` shows the updated name

Additional unit cases:
- [ ] returns 400 when X-User-Id is missing
- [ ] returns 400 when `name` is missing from body
- [ ] returns 404 when group is not found

---

## Catalogue / DELETE /api/groups/:id

**Unit:** returns 204 for valid request
**E2E:** soft-deletes a group and `GET /api/groups` no longer returns it

Additional unit cases:
- [ ] returns 400 when X-User-Id is missing
- [ ] returns 404 when group is not found
- [ ] returns 422 when group is already deleted (DomainError → 422 mapping verified)

---

## Catalogue / GET /api/groups

**Unit:** returns 200 with `{ groups: Array<{ id: string, name: string }> }`
**E2E:** seeds groups and `GET /api/groups` returns them

Additional unit cases:
- [ ] returns 400 when X-Household-Id is missing
- [ ] returns 200 with empty array when no groups exist

---

## Catalogue / POST /api/categories

**Unit:** returns 201 with `{ id: string }` for valid body + headers
**E2E:** creates a category and `GET /api/categories?groupId=...` returns it

Additional unit cases:
- [ ] returns 400 when X-Household-Id is missing
- [ ] returns 400 when `name` or `groupId` is missing from body
- [ ] returns 404 when group is not found

---

## Catalogue / PATCH /api/categories/:id/name

**Unit:** returns 204 for valid request
**E2E:** renames a category and `GET /api/categories?groupId=...` shows the updated name

Additional unit cases:
- [ ] returns 400 when `name` is missing from body
- [ ] returns 404 when category is not found

---

## Catalogue / PATCH /api/categories/:id/group

**Unit:** returns 204 for valid request
**E2E:** moves a category and `GET /api/categories?groupId=<newGroupId>` returns it

Additional unit cases:
- [ ] returns 400 when `groupId` is missing from body
- [ ] returns 404 when category is not found
- [ ] returns 404 when target group is not found

---

## Catalogue / DELETE /api/categories/:id

**Unit:** returns 204 for valid request
**E2E:** soft-deletes a category and `GET /api/categories?groupId=...` no longer returns it

Additional unit cases:
- [ ] returns 404 when category is not found
- [ ] returns 422 when category is already deleted

---

## Catalogue / GET /api/categories

**Unit:** returns 200 with `{ categories: Array<{ id: string, name: string, groupId: string }> }`
**E2E:** seeds categories for a group and `GET /api/categories?groupId=...` returns them

Additional unit cases:
- [ ] returns 400 when `groupId` query param is missing

---

## Expense / POST /api/expenses

**Unit:** returns 201 with `{ id: string }` for a valid cash expense
**E2E:** logs an expense and `GET /api/expenses` returns it in the list

Additional unit cases:
- [ ] returns 400 when X-User-Id is missing
- [ ] returns 400 when X-Household-Id is missing
- [ ] returns 400 when required fields (amount, currency, categoryId, date, paymentMethod) are missing
- [ ] returns 404 when category is not found

---

## Expense / DELETE /api/expenses/:id

**Unit:** returns 204 for valid request
**E2E:** logs then deletes an expense; `GET /api/expenses` no longer returns it

Additional unit cases:
- [ ] returns 400 when X-User-Id is missing
- [ ] returns 404 when expense is not found

---

## Expense / GET /api/expenses

**Unit:** returns 200 with `{ items: [...], total: number }` (paginated)
**E2E:** seeds expenses and `GET /api/expenses` returns them with correct total

Additional unit cases:
- [ ] returns 400 when X-Household-Id is missing

---

## Expense / POST /api/payment-instruments

**Unit:** returns 201 with `{ id: string }` for valid body + X-User-Id
**E2E:** creates an instrument and `GET /api/payment-instruments` returns it

Additional unit cases:
- [ ] returns 400 when X-User-Id is missing
- [ ] returns 400 when `type` or `name` is missing

---

## Expense / PATCH /api/payment-instruments/:id/name

**Unit:** returns 204 for valid request
**E2E:** renames an instrument and `GET /api/payment-instruments` shows the new name

Additional unit cases:
- [ ] returns 400 when `name` is missing from body
- [ ] returns 404 when instrument is not found

---

## Expense / DELETE /api/payment-instruments/:id

**Unit:** returns 204 for valid request
**E2E:** soft-deletes an instrument and `GET /api/payment-instruments` no longer returns it

Additional unit cases:
- [ ] returns 404 when instrument is not found
- [ ] returns 422 when instrument is already deleted

---

## Expense / GET /api/payment-instruments

**Unit:** returns 200 with `{ instruments: Array<{ id: string, userId: string, type: string, name: string }> }`
**E2E:** seeds instruments and `GET /api/payment-instruments` returns them

Additional unit cases:
- [ ] returns 400 when X-User-Id is missing

---

## Budget / POST /api/budget-limits

**Unit:** returns 201 with `{ id: string }` for a valid category-based limit
**E2E:** creates a budget limit and `GET /api/budget-limits` returns it

Additional unit cases:
- [ ] returns 400 when X-Household-Id is missing
- [ ] returns 400 when `money` or `period` is missing
- [ ] returns 400 when neither `categoryId` nor `groupId` is provided

---

## Budget / PATCH /api/budget-limits/:id

**Unit:** returns 204 for valid request
**E2E:** edits a budget limit and `GET /api/budget-limits/:id/balance` reflects the new cap

Additional unit cases:
- [ ] returns 400 when `money` or `period` is missing
- [ ] returns 404 when budget limit is not found

---

## Budget / DELETE /api/budget-limits/:id

**Unit:** returns 204 for valid request
**E2E:** deletes a budget limit and `GET /api/budget-limits` no longer includes it

Additional unit cases:
- [ ] returns 400 when X-User-Id is missing
- [ ] returns 404 when budget limit is not found

---

## Budget / GET /api/budget-limits/:id/balance

**Unit:** returns 200 with `{ remaining: { amount: number, currency: string } }`
**E2E:** creates a limit, logs matching expenses, then `GET /api/budget-limits/:id/balance` returns the correct remaining amount

Additional unit cases:
- [ ] returns 404 when budget limit is not found

---

## Budget / GET /api/budget-limits

**Unit:** returns 200 with `{ limits: Array<{ id: string, money: {...}, period: {...}, categoryId?: string, groupId?: string }> }`
**E2E:** seeds budget limits and `GET /api/budget-limits` returns them

Additional unit cases:
- [ ] returns 400 when X-Household-Id is missing
