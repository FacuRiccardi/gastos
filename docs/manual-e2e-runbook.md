# Manual E2E Runbook

Hands-on test script using curl + psql. Covers every endpoint in order, with DB
verification after each write operation.

## Known domain rules

- **CreditCard payment requires `installmentPlan`** — omitting it returns a 422.
- **Budget limits must be scoped** — `categoryId` or `groupId` is required; household-wide limits are rejected.
- **Groups and categories are soft-deleted** — `deleted_at` is set, row remains, list excludes it.
- **Expenses are hard-deleted** — row is fully removed from DB.

## Known bugs (as of 2026-06-05)

- **Date off-by-one**: `new Date("YYYY-MM-DD")` parses as UTC midnight. In UTC-3, dates are stored and returned one day behind what was sent. Affects all expense dates.
- **`categoryId` filter broken**: `GET /expenses?categoryId=<uuid>` fails with `oneOf` validation error. Use `groupId` filter instead until fixed.

## Prerequisites

1. Start the DB and server in a devbox shell:
   ```bash
   devbox run start
   # Listens on :3000
   ```
2. DB is accessible from outside devbox via:
   ```bash
   devbox run -- psql -h /tmp -U postgres -p 5432 -d gastos -c '<query>'
   ```
3. Auth is header-based — no tokens:
   - `X-User-Id: <uuid>` — required for most endpoints
   - `X-Household-Id: <uuid>` — required for household-scoped endpoints

Run the tests **in order** — later tests depend on IDs captured from earlier ones.

---

## 1. Identity

### 1.1 Create user A
```bash
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}' | jq
# Expect: {"id": "<uuid>"}
# Capture: USER_A=<id>
```
DB check:
```bash
devbox run -- psql -h /tmp -U postgres gastos -c "SELECT * FROM users WHERE id='$USER_A';"
```

### 1.2 Create user B (for join test)
```bash
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob"}' | jq
# Capture: USER_B=<id>
```

### 1.3 Create household
```bash
curl -s -X POST http://localhost:3000/households \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -d '{"name": "Home"}' | jq
# Expect: {"id": "<uuid>"}
# Capture: HH=<id>
```
DB check:
```bash
devbox run -- psql -h /tmp -U postgres gastos \
  -c "SELECT * FROM households;" \
  -c "SELECT * FROM household_members WHERE user_id='$USER_A';"
```

### 1.4 User B joins household
```bash
curl -s -X POST "http://localhost:3000/households/$HH/members" \
  -H "X-User-Id: $USER_B"
# Expect: 204
```
DB check:
```bash
devbox run -- psql -h /tmp -U postgres gastos \
  -c "SELECT * FROM household_members WHERE household_id='$HH';"
# Expect: 2 rows (Alice + Bob)
```

### 1.5 Auth error cases
```bash
# Missing X-User-Id → 400
curl -s -X POST http://localhost:3000/households \
  -H "Content-Type: application/json" -d '{"name":"x"}' | jq

# Missing X-Household-Id → 400
curl -s http://localhost:3000/groups -H "X-User-Id: $USER_A" | jq
```

---

## 2. Catalogue — Groups

### 2.1 Create group
```bash
curl -s -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d '{"name": "Food"}' | jq
# Capture: GROUP=<id>
```
DB check:
```bash
devbox run -- psql -h /tmp -U postgres gastos -c "SELECT * FROM groups WHERE id='$GROUP';"
```

### 2.2 Rename group
```bash
curl -s -X PATCH "http://localhost:3000/groups/$GROUP/name" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d '{"name": "Groceries"}'
# Expect: 204
```
DB check: `name` column should now be `Groceries`.

### 2.3 List groups
```bash
curl -s http://localhost:3000/groups \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: {"groups": [{"id":"...", "name":"Groceries"}]}
```

### 2.4 Create a second group (needed for category move test)
```bash
curl -s -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d '{"name": "Transport"}' | jq
# Capture: GROUP2=<id>
```

### 2.5 Delete group (soft-delete)
```bash
curl -s -X DELETE "http://localhost:3000/groups/$GROUP2" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH"
# Expect: 204
```
DB check: row should still exist with `deleted_at` set; list should exclude it.
```bash
devbox run -- psql -h /tmp -U postgres gastos -c "SELECT id, name, deleted_at FROM groups;"
curl -s http://localhost:3000/groups \
  -H "X-User-Id: $USER_A" -H "X-Household-Id: $HH" | jq
# GROUP2 should not appear in the list
```

---

## 3. Catalogue — Categories

Requires an active group. Use `GROUP` from step 2.1.

### 3.1 Create category
```bash
curl -s -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"name\": \"Supermarket\", \"groupId\": \"$GROUP\"}" | jq
# Capture: CAT=<id>
```

### 3.2 Rename category
```bash
curl -s -X PATCH "http://localhost:3000/categories/$CAT/name" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d '{"name": "Farmers Market"}'
# Expect: 204
```

### 3.3 Create a target group and move category there
```bash
curl -s -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d '{"name": "Leisure"}' | jq
# Capture: GROUP3=<id>

curl -s -X PATCH "http://localhost:3000/categories/$CAT/group" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"groupId\": \"$GROUP3\"}"
# Expect: 204
```
DB check: `group_id` on the category row should now be `$GROUP3`.

### 3.4 List categories by group
```bash
curl -s "http://localhost:3000/categories?groupId=$GROUP3" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: category "Farmers Market" appears
```

### 3.5 Delete category (soft-delete)
```bash
# Create a throwaway category to delete
curl -s -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"name\": \"Temp\", \"groupId\": \"$GROUP\"}" | jq
# Capture: CAT_TMP=<id>

curl -s -X DELETE "http://localhost:3000/categories/$CAT_TMP" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH"
# Expect: 204; list should exclude it
```

---

## 4. Payment Instruments

### 4.1 Create credit card instrument
```bash
curl -s -X POST http://localhost:3000/payment-instruments \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -d '{"type": "CreditCard", "name": "Visa Gold"}' | jq
# Capture: PI=<id>
```
DB check:
```bash
devbox run -- psql -h /tmp -U postgres gastos -c "SELECT * FROM payment_instruments;"
```

### 4.2 Create bank account instrument
```bash
curl -s -X POST http://localhost:3000/payment-instruments \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -d '{"type": "BankAccount", "name": "Checking"}' | jq
# Capture: PI2=<id>
```

### 4.3 Invalid type → 400
```bash
curl -s -X POST http://localhost:3000/payment-instruments \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -d '{"type": "Cash", "name": "Wallet"}' | jq
# Expect: 400 (enum validation rejects "Cash")
```

### 4.4 Rename instrument
```bash
curl -s -X PATCH "http://localhost:3000/payment-instruments/$PI/name" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -d '{"name": "Visa Platinum"}'
# Expect: 204
```

### 4.5 List instruments
```bash
curl -s http://localhost:3000/payment-instruments \
  -H "X-User-Id: $USER_A" | jq
# Expect: both PI (renamed) and PI2 in the list
```

### 4.6 Delete instrument (soft-delete)
```bash
curl -s -X DELETE "http://localhost:3000/payment-instruments/$PI2" \
  -H "X-User-Id: $USER_A"
# Expect: 204; PI2 should not appear in subsequent list call
```

---

## 5. Expenses

Requires `CAT` (from step 3.1) and `PI` (from step 4.1).

### 5.1 Log a cash expense
> Note: `new Date("YYYY-MM-DD")` parses dates as UTC midnight and shifts them one day back in UTC-3. Dates shown in responses will be one day behind what was sent — known bug.
```bash
curl -s -X POST http://localhost:3000/expenses \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"categoryId\": \"$CAT\", \"money\": {\"amount\": 50.00, \"currency\": \"ARS\"}, \"paymentMethod\": {\"kind\": \"Cash\"}, \"date\": \"2026-06-01\"}" | jq
# Capture: EXP1=<id>
```
DB check:
```bash
devbox run -- psql -h /tmp -U postgres gastos -c "SELECT * FROM expenses WHERE id='$EXP1';"
```

### 5.2 Log a credit card expense
> CreditCard requires `installmentPlan` — omitting it returns a 422.
```bash
curl -s -X POST http://localhost:3000/expenses \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"categoryId\": \"$CAT\", \"money\": {\"amount\": 120.00, \"currency\": \"ARS\"}, \"paymentMethod\": {\"kind\": \"CreditCard\", \"instrumentId\": \"$PI\"}, \"date\": \"2026-06-02\", \"installmentPlan\": {\"count\": 3}}" | jq
# Capture: EXP2=<id>
```

### 5.3 Log an installment expense
```bash
curl -s -X POST http://localhost:3000/expenses \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"categoryId\": \"$CAT\", \"money\": {\"amount\": 600.00, \"currency\": \"ARS\"}, \"paymentMethod\": {\"kind\": \"CreditCard\", \"instrumentId\": \"$PI\"}, \"date\": \"2026-06-03\", \"installmentPlan\": {\"count\": 6}}" | jq
# Capture: EXP3=<id>
```
DB check: `installment_count` column should be 6.

### 5.4 List expenses (no filters)
```bash
curl -s http://localhost:3000/expenses \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: {items: [...3 expenses], total: 3}
```

### 5.5 Filter by date range
```bash
curl -s "http://localhost:3000/expenses?from=2026-06-02&to=2026-06-02" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: only EXP2
```

### 5.6 Filter by categoryId
> **BROKEN** — `oneOf` schema validation rejects a single string value. Skip until fixed.
```bash
# Currently returns: {"error": "querystring/categoryId must match exactly one schema in oneOf"}
curl -s "http://localhost:3000/expenses?categoryId=$CAT" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
```

### 5.7 Filter by paymentInstrumentId
```bash
curl -s "http://localhost:3000/expenses?paymentInstrumentId=$PI" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: EXP2 and EXP3 (both credit card with PI)
```

### 5.8 Pagination
```bash
curl -s "http://localhost:3000/expenses?limit=2&offset=0" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: 2 items returned, total still 3
```

### 5.9 Delete expense
```bash
curl -s -X DELETE "http://localhost:3000/expenses/$EXP1" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH"
# Expect: 204
```
DB check: row should be gone (hard delete).

### 5.10 Cross-household delete → should fail
```bash
curl -s -X DELETE "http://localhost:3000/expenses/$EXP2" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: 00000000-0000-0000-0000-000000000000" | jq
# Expect: 404 or 403 (expense doesn't belong to that household)
```

---

## 6. Budget Limits

Requires `CAT` and `GROUP` from earlier steps.

### 6.1 Create monthly group-scoped budget
> Budget limits require `categoryId` or `groupId` — household-wide budgets are rejected.
```bash
curl -s -X POST http://localhost:3000/budget-limits \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"money\": {\"amount\": 10000, \"currency\": \"ARS\"}, \"period\": {\"kind\": \"Monthly\"}, \"groupId\": \"$GROUP\"}" | jq
# Capture: BL1=<id>
```
DB check:
```bash
devbox run -- psql -h /tmp -U postgres gastos -c "SELECT * FROM budget_limits;"
```

### 6.2 Create category-scoped budget
```bash
curl -s -X POST http://localhost:3000/budget-limits \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"money\": {\"amount\": 3000, \"currency\": \"ARS\"}, \"period\": {\"kind\": \"Monthly\"}, \"categoryId\": \"$CAT\"}" | jq
# Capture: BL2=<id>
```

### 6.3 Create Rolling30Days budget
```bash
curl -s -X POST http://localhost:3000/budget-limits \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"money\": {\"amount\": 5000, \"currency\": \"ARS\"}, \"period\": {\"kind\": \"Rolling30Days\"}, \"groupId\": \"$GROUP\"}" | jq
# Capture: BL3=<id>
```

### 6.4 Create Custom period budget
```bash
curl -s -X POST http://localhost:3000/budget-limits \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d "{\"money\": {\"amount\": 2000, \"currency\": \"ARS\"}, \"period\": {\"kind\": \"Custom\", \"startDate\": \"2026-06-01\", \"endDate\": \"2026-06-30\"}, \"categoryId\": \"$CAT\"}" | jq
# Capture: BL4=<id>
```

### 6.5 List budget limits
```bash
curl -s http://localhost:3000/budget-limits \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: all 4 limits; Custom period includes startDate/endDate fields
```

### 6.6 Get balance for monthly budget
```bash
curl -s "http://localhost:3000/budget-limits/$BL1/balance" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: {"remaining": {"amount": <10000 - June expenses>, "currency": "ARS"}}
# Manual check: EXP2 (120) + EXP3 (600) = 720 spent → remaining should be 9280
```

### 6.7 Edit budget limit
```bash
curl -s -X PATCH "http://localhost:3000/budget-limits/$BL1" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" \
  -d '{"money": {"amount": 15000, "currency": "ARS"}, "period": {"kind": "Monthly"}}'
# Expect: 204
```
DB check: amount should now be 15000.

### 6.8 Balance reflects updated cap
```bash
curl -s "http://localhost:3000/budget-limits/$BL1/balance" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH" | jq
# Expect: remaining ≈ 14280 (15000 - 720)
```

### 6.9 Delete budget limit
```bash
curl -s -X DELETE "http://localhost:3000/budget-limits/$BL4" \
  -H "X-User-Id: $USER_A" \
  -H "X-Household-Id: $HH"
# Expect: 204; BL4 should not appear in subsequent list call
```

---

## Quick reference: all endpoints

| Method | Path | Auth headers |
|--------|------|-------------|
| POST | /users | — |
| POST | /households | X-User-Id |
| POST | /households/:id/members | X-User-Id |
| POST | /groups | X-User-Id, X-Household-Id |
| PATCH | /groups/:id/name | X-User-Id, X-Household-Id |
| DELETE | /groups/:id | X-User-Id, X-Household-Id |
| GET | /groups | X-User-Id, X-Household-Id |
| POST | /categories | X-User-Id, X-Household-Id |
| PATCH | /categories/:id/name | X-User-Id, X-Household-Id |
| PATCH | /categories/:id/group | X-User-Id, X-Household-Id |
| DELETE | /categories/:id | X-User-Id, X-Household-Id |
| GET | /categories?groupId= | X-User-Id, X-Household-Id |
| POST | /payment-instruments | X-User-Id |
| PATCH | /payment-instruments/:id/name | X-User-Id |
| DELETE | /payment-instruments/:id | X-User-Id |
| GET | /payment-instruments | X-User-Id |
| POST | /expenses | X-User-Id, X-Household-Id |
| DELETE | /expenses/:id | X-User-Id, X-Household-Id |
| GET | /expenses | X-User-Id, X-Household-Id |
| POST | /budget-limits | X-User-Id, X-Household-Id |
| PATCH | /budget-limits/:id | X-User-Id, X-Household-Id |
| DELETE | /budget-limits/:id | X-User-Id, X-Household-Id |
| GET | /budget-limits/:id/balance | X-User-Id, X-Household-Id |
| GET | /budget-limits | X-User-Id, X-Household-Id |
