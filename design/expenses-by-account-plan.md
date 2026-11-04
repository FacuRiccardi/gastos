# Expenses grouped by account and statement period — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Gastos tab shows account → period tabs → credit card → purchases, with subtotals and one "Total a pagar" built from the latest period with loaded dates of every account.

**Architecture:** Pure functions turn `(expenses, accounts, cards, cycles)` into per-account views (period tabs, per-card groups, per-currency totals) and a total to pay; small presentational components render them; `App` shares one cards subscription between the Gastos and Tarjetas tabs. No new collections, no rule changes, no writes.

**Tech Stack:** Same as the web app (React, TypeScript, shadcn/ui, Vitest, Testing Library).

**Spec:** `design/expenses-by-account-spec.md` (builds on `design/web-app-spec.md` and `design/cards-spec.md`)

## Global Constraints

- The repository is **public**: no personal data (names, real card digits, real dates), project IDs or Firebase config; all test data is made up.
- Calendar dates are `YYYY-MM-DD` strings; a purchase's day is its **Buenos Aires** calendar day (`America/Argentina/Buenos_Aires`); the UI shows `dd/mm/yyyy`. Vitest runs with `TZ=UTC` (see `web/vite.config.ts`), so tests prove the explicit time zone.
- A period is `(previous closing, closing]` for consecutive stored closing dates of one account; the closing day belongs to the period that ends on it. The oldest closing date has no tab of its own. "Sin periodo" = purchases after the latest closing (or all purchases when the account has no dates); "Viejos" = purchases on or before the oldest closing.
- Card identity = last 4 digits + type; one group per stored **credit** card of an existing account, merging purchases whatever the expense's holder; the shown holder is the stored one. Debit cards and cards without an account (not stored, or stored under a missing account) never appear in Gastos nor in any total.
- Rejected purchases (`status: "rejected"`) are listed (greyed, badge "Rechazado"), counted in the purchase count, but never added to any subtotal or total; a missing status counts as approved. Currencies are never mixed: every amount is a `Record<currency, number>` rounded to cents (`Math.round(sum * 100) / 100`), displayed joined with ` · `.
- "Total a pagar" = sum over accounts of the period `(c(N-1), c(N)]` (the latest period with loaded dates); it never uses "Sin periodo" and ignores the tab selected in each account; accounts with fewer than two closing dates do not contribute and are listed as not contributing.
- The cards source and API are created only after authorization (as today). Gastos shows loading while expenses or cards load and an error (never partial totals) if either subscription fails.
- UI texts in Argentine Spanish in `web/src/strings.ts`; English code and docs; TypeScript strict. `web/src/lib/dates.ts` must not use the `@/` alias.
- The user's global npm registry is private: **never run `npm install`/`npm ci`** (it also re-adds a stray `card-expenses` dependency); do not touch `web/package*.json`; no new dependencies are needed.
- Git: work on the current branch `cards-section`; commits with author `FacuRiccardi <FacuRiccardi@users.noreply.github.com>` (via `git -c user.name=... -c user.email=...`) ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; explicit `git add <paths>`; never push.
- All existing suites stay green: `npm test`, `npm run test:store`, `npm run test:rules`, `npm --prefix web test`, `npm run web:build`.

## Review Focus

1. **Boundaries and time zone:** a purchase at 23:30 Buenos Aires on a closing day (already the next day in UTC) belongs to the period ending that day; the day after a closing belongs to the next period or to "Sin periodo"; every purchase of an account lands in exactly one tab (Tasks 1, 2, 3).
2. **The total to pay:** it excludes "Sin periodo", rejected purchases, debit and unassigned cards, and accounts with fewer than two closing dates (which are reported), and uses `(c(N-1), c(N)]` whatever tab is selected (Tasks 4, 6).
3. **Card identity:** a credit and a debit card with the same last 4 are different cards; an expense whose holder differs from the stored holder still goes to the stored card; a stored card whose account was deleted is out (Task 3).
4. **Amounts:** two currencies never add together; `0.1 + 0.2`-style sums are rounded to cents; a card with no purchases shows "Sin compras", not a number (Tasks 3, 5).
5. **Degenerate inputs:** unsorted closing dates, cycles of a missing account, an account with exactly one closing date (no period tabs; everything on or before it is "Viejos", after it "Sin periodo"), an account with no dates, no credit cards, or no purchases (Tasks 2, 3, 5).
6. **States:** the cards source is never created before authorization; if either subscription fails Gastos shows an error and no totals; the expenses are still subscribed once (Task 6).

## File Structure

```
web/src/lib/dates.ts (+ test)                    + addDays, buenosAiresDay, TIME_ZONE
web/src/lib/format.ts                            imports TIME_ZONE from dates.ts
web/src/expenses/statements.ts (+ test)          periods, tabs, account views, total to pay (pure)
web/src/expenses/PurchasesTable.tsx              date/merchant/amount table (extracted from ExpenseGroups)
web/src/expenses/TotalToPay.tsx (+ test)         total number + periods used
web/src/expenses/ExpensesByAccount.tsx (+ test)  account sections with period tabs and card groups
web/src/App.tsx, App.test.tsx, strings.ts        wiring and texts
web/src/expenses/ExpenseGroups.tsx, groupExpenses.ts   removed when unused (Task 6)
README.md                                        Gastos description
```

---

### Task 1: Date helpers

**Files:** Modify `web/src/lib/dates.ts`, `web/src/lib/dates.test.ts`, `web/src/lib/format.ts`

**Interfaces:**
- Produces: `addDays(value: string, days: number): string` (`YYYY-MM-DD` plus/minus whole days, calendar arithmetic with `Date.UTC`, no time-zone dependence), `buenosAiresDay(date: Date): string` (the Buenos Aires calendar day of an instant as `YYYY-MM-DD`), `export const TIME_ZONE = 'America/Argentina/Buenos_Aires'` (`format.ts` imports it instead of its own constant; behavior of `formatDate` unchanged).

- [ ] **Step 1: Tests** in `dates.test.ts`: `addDays crosses month and year ends` (`2026-10-31`+1 → `2026-11-01`; `2025-12-31`+1 → `2026-01-01`; `2026-03-01`-1 → `2026-02-28`; `2028-02-28`+1 → `2028-02-29`), `buenosAiresDay uses the Buenos Aires day, not UTC` (`new Date('2026-11-16T02:30:00Z')` → `2026-11-15`; `new Date('2026-11-15T03:00:00Z')` → `2026-11-15`; `new Date('2026-11-15T02:59:00Z')` → `2026-11-14`).
- [ ] **Step 2:** `npm --prefix web test -- dates`; expected FAIL (functions missing). **Step 3:** implement (`Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })` or `formatToParts`) and point `format.ts` at the shared constant. **Step 4:** `npm --prefix web test` PASS (existing `format` tests included). Commit `feat(web): date helpers for statement periods`.

### Task 2: Periods and tab assignment

**Files:** Create `web/src/expenses/statements.ts`, `web/src/expenses/statements.test.ts` (this task adds the first two functions only)

**Interfaces:**
- Consumes: `addDays`, `buenosAiresDay` (Task 1).
- Produces (all exported from `statements.ts`): `type MoneyTotals = Record<string, number>`; `type Period = { start: string; end: string }` (`start` = previous closing + 1 day, `end` = the closing day); `buildPeriods(closingDates: string[]): Period[]` — input in any order and possibly with repeats, output **newest first**, `[]` with fewer than two distinct dates; `tabIdFor(day: string, closingDates: string[]): string` — `'open'` when `day` is after the latest closing or the list is empty, `'old'` when `day` is on or before the oldest closing (and the list is not empty), otherwise `` `period:${end}` `` of the period containing `day`; `periodTabId(period: Period): string` (`` `period:${period.end}` ``).

- [ ] **Step 1: Tests:** `buildPeriods` — `builds consecutive periods newest first` (`['2026-09-15','2026-10-15','2026-11-15']` → `[{start:'2026-10-16',end:'2026-11-15'},{start:'2026-09-16',end:'2026-10-15'}]`), `sorts unsorted input and ignores repeats`, `returns no periods with fewer than two dates` (`[]`, one date), `a period crosses the year end` (`2025-12-15`,`2026-01-15` → start `2025-12-16`). `tabIdFor` with closings `['2026-09-15','2026-10-15','2026-11-15']`: `the closing day belongs to the period that ends on it` (`2026-11-15` → `period:2026-11-15`), `the day after a closing is in the next period` (`2026-10-16` → `period:2026-11-15`), `the first day after the oldest closing is in the first period` (`2026-09-16` → `period:2026-10-15`), `on or before the oldest closing is old` (`2026-09-15`, `2020-01-01` → `old`), `after the latest closing is open` (`2026-11-16` → `open`), `no dates means open` (`[]` → `open`), `a single date: before or on it is old, after it is open` (Review Focus 5), `works with unsorted closing dates`.
- [ ] **Step 2:** `npm --prefix web test -- statements`; expected FAIL. **Step 3:** implement. **Step 4:** PASS. Commit `feat(web): statement periods and tab assignment`.

### Task 3: Account views

**Files:** Modify `web/src/expenses/statements.ts`, `statements.test.ts`

**Interfaces:**
- Consumes: Task 2 functions; `Expense` (`@/lib/groupExpenses`; inside `statements.ts` use `@/` or relative imports as the rest of `web/src/expenses`), `Account`, `Card`, `CardsData` (`web/src/cards`).
- Produces: `type CardView = { card: Card; expenses: Expense[]; count: number; totals: MoneyTotals }` (`expenses` newest first; `count` includes rejected); `type TabView = { id: string; kind: 'open' | 'period' | 'old'; period: Period | null; cards: CardView[]; totals: MoneyTotals; count: number }` (`cards` = **every** credit card of the account ordered by holder then last 4, with empty `expenses` when it has no purchase in this tab; `totals` = sum of the cards' totals); `type AccountView = { account: Account; tabs: TabView[]; latestPeriod: Period | null; creditCardCount: number }` (`tabs` ordered: `open`, periods newest first, `old`; `latestPeriod` = `buildPeriods(...)[0] ?? null`); `buildAccountViews(expenses: Expense[], data: CardsData): AccountView[]` — accounts ordered by name (`localeCompare` with `'es-AR'`); cycles of accounts that do not exist are ignored; only expenses whose last 4 + type match a **credit** card stored under an existing account are used; the tab of an expense is `tabIdFor(buenosAiresDay(expense.purchaseDate), closingDates)`; period tabs always exist; the `open` tab exists when it has at least one purchase **or** the account has no closing dates; the `old` tab exists only when it has at least one purchase; rejected purchases are in `expenses`/`count` but not in `totals`.

- [ ] **Step 1: Tests** (made-up accounts/cards/expenses, helper builders in the test file): `groups purchases by account, tab and card` , `a purchase at 23:30 Buenos Aires on the closing day is in that period` (`purchaseDate: new Date('2026-11-16T02:30:00Z')`, closing `2026-11-15`; Review Focus 1), `every purchase lands in exactly one tab` (a set of purchases around the boundaries; the sum of `count` over tabs equals the number of purchases of the account), `lists every credit card of the account even without purchases`, `matches by last 4 and type, not by holder` (expense holder differs from stored holder → same card), `a credit and a debit card with the same last 4 are different` (the debit one is not in any tab), `debit cards, unassigned cards and cards of a missing account are left out`, `rejected purchases are listed and counted but not added to totals`, `totals are kept per currency and rounded to cents` (`0.1` + `0.2` ARS → `0.3`; a USD purchase stays apart), `an account with no closing dates has only the open tab with everything`, `an account with one closing date has open and old tabs and no periods` (Review Focus 5), `open and old tabs are hidden when empty`, `cycles of a missing account are ignored`, `accounts are ordered by name and cards by holder then last 4`, `an account without credit cards has tabs and zero totals` (`creditCardCount: 0`).
- [ ] **Step 2:** FAIL. **Step 3:** implement `buildAccountViews` (index cards by `cardKey`; group once per expense). **Step 4:** PASS. Commit `feat(web): account views by statement period`.

### Task 4: Total to pay

**Files:** Modify `web/src/expenses/statements.ts`, `statements.test.ts`

**Interfaces:**
- Consumes: `AccountView`, `TabView`, `periodTabId` (Tasks 2, 3).
- Produces: `type TotalToPayResult = { totals: MoneyTotals; included: { account: Account; period: Period; totals: MoneyTotals }[]; excluded: Account[] }`; `computeTotalToPay(views: AccountView[]): TotalToPayResult` — for each view with `latestPeriod`, add the totals of the tab `periodTabId(latestPeriod)` (never the `open` tab) and list `{ account, period, totals }` in `included` (same order as `views`); views without `latestPeriod` go to `excluded`.

- [ ] **Step 1: Tests:** `sums the latest period of every account` (two accounts, different closings), `never uses the open tab` (purchases after the latest closing do not change the total; Review Focus 2), `does not depend on any tab selection` (pure function: same result), `rejected, debit and unassigned purchases are not counted`, `accounts with fewer than two closing dates are excluded and reported` (one date, no dates), `lists the period used for each account`, `currencies are not mixed` (ARS and USD apart), `an account whose latest period has no purchases contributes nothing but is still listed as included`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. Commit `feat(web): total to pay`.

### Task 5: Components

**Files:** Create `web/src/expenses/PurchasesTable.tsx`, `TotalToPay.tsx`, `TotalToPay.test.tsx`, `ExpensesByAccount.tsx`, `ExpensesByAccount.test.tsx`; Modify `web/src/expenses/ExpenseGroups.tsx` (import the extracted table), `web/src/strings.ts`

**Interfaces:**
- Consumes: Tasks 3-4 types/functions; shadcn `tabs`, `accordion`, `table`, `badge`; `formatMoney`, `formatDate`, `formatCalendarDate`.
- Produces: `PurchasesTable({ expenses }: { expenses: Expense[] })` (the date / merchant / amount table with the greyed row and "Rechazado" badge, moved out of `ExpenseGroups`, no behavior change); `TotalToPay({ result }: { result: TotalToPayResult })`; `ExpensesByAccount({ expenses, data }: { expenses: Expense[]; data: CardsData })` (calls `buildAccountViews` and `computeTotalToPay` with `useMemo`, renders `TotalToPay` on top and one `AccountSection` per account; no accounts → `strings.gastos.noAccounts`); an internal `AccountSection({ view })` — title `strings.cards.accountTitle(name)`, tabs in the view's order with the first as default, selection kept in state while that tab still exists and falling back to the first otherwise, the selected tab's total, one accordion item per card (holder, `Crédito ····last4`, purchases count, subtotal or `strings.gastos.noPurchases` when `count` is 0; expanding shows `PurchasesTable`), `strings.gastos.noCreditCards` when `creditCardCount` is 0.
- Texts (`strings.gastos`): `noAccounts: 'Todavía no hay cuentas. Creá una en la pestaña Tarjetas para ver los gastos agrupados.'`, `totalToPay: 'Total a pagar'`, `noPurchases: 'Sin compras'`, `noCreditCards: 'Esta cuenta no tiene tarjetas de crédito.'`, `tabs: { open: 'Sin periodo', old: 'Viejos' }`, `periodLabel(period)` (`16/10 – 15/11/2026`; when the years differ `16/12/2025 – 15/01/2026`), `periodTotal: 'Total del período'`, `excluded: (name: string) => \`${name}: sin períodos con fechas cargadas, no suma\``.

- [ ] **Step 1: Tests.** `TotalToPay.test.tsx`: `shows the total number and the period used for each account` (text with account name, `periodLabel`, amount), `shows one line per currency`, `lists the accounts that do not contribute`, `shows zero when nothing is included`. `ExpensesByAccount.test.tsx` (real logic, fake data): `shows one section per account with its period tabs, newest first, Sin periodo first when it has purchases`, `the first tab is selected by default`, `selecting a period shows that period's cards and subtotal`, `lists every credit card with Sin compras when empty`, `debit and unassigned purchases are not shown anywhere`, `shows rejected purchases greyed and not in the subtotal`, `an account with no dates shows only Sin periodo with all its purchases`, `Viejos tab appears only with old purchases`, `the Total a pagar does not change when another tab is selected` (Review Focus 2), `shows the empty state when there are no accounts`, `keeps the selected tab when the data updates and falls back to the first when it disappears` (rerender with new `data`).
- [ ] **Step 2:** `npm --prefix web test -- ExpensesByAccount TotalToPay`; expected FAIL. **Step 3:** implement; existing `ExpenseGroups` tests must stay green after the table extraction. **Step 4:** `npm --prefix web test` PASS, `npm --prefix web run build` clean. Commit `feat(web): expenses by account and period components`.

### Task 6: Wiring, cleanup and documentation

**Files:** Modify `web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/strings.ts`, `README.md`; Delete `web/src/expenses/ExpenseGroups.tsx`, `ExpenseGroups.test.tsx`, `web/src/lib/groupExpenses.ts` logic + `groupExpenses.test.ts` **only if nothing uses them any more** (keep the `Expense` type exported from `web/src/lib/groupExpenses.ts` or move it to `web/src/lib/expense.ts` and update imports; the builder decides, keeping all remaining tests meaningful).

**Interfaces:**
- Consumes: `ExpensesByAccount` (Task 5), `useCards`, `useExpenses`.
- Produces: `Authorized` calls `useCards(cardsSource)` **once** and passes its state to both tabs (so the cards subscription lives as long as the authorized view); the Gastos tab renders: loading while `expenses.status` or `cards.status` is `loading`; `role="alert"` with `strings.expenses.error` or `strings.cards.error` when either is `error` (no totals); otherwise `ExpensesByAccount`. The Tarjetas tab renders from the same cards state (loading/error/`CardsScreen`) exactly as before.

- [ ] **Step 1: Tests** (extend `App.test.tsx`; update the existing Gastos-tab tests that looked for the old person + card groups so they assert the new view): `the Gastos tab shows the account sections and the total to pay`, `Gastos shows loading until both expenses and cards arrive`, `Gastos shows an error and no totals when the cards subscription fails` (permission-denied) and `... when the expenses subscription fails` (Review Focus 6), `the cards source and api are never created unless authorized` (still passing), `expenses and cards are each subscribed once, also after switching tabs`, `the Tarjetas tab still shows the accounts and the cards error`.
- [ ] **Step 2:** `npm --prefix web test -- App`; expected FAIL (new assertions). **Step 3:** implement the wiring; remove dead code; update the README description of the Gastos tab (account → period → card, "Total a pagar", what is left out). **Step 4:** run everything: `npm test`, `npm run test:store`, `npm run test:rules`, `npm --prefix web test`, `npm run web:build`; expected all green; `git grep --cached` for personal data (emails, project IDs, real-looking card digits/names) → none; `web/package*.json` unchanged. Commit `feat(web): Gastos grouped by account and statement period`.

---

## Self-review (done)

- **Spec coverage:** structure account → tab → card (T3, T5), periods and the oldest-closing rule (T2), Sin periodo / Viejos / default tab / hidden-when-empty (T3, T5), no-dates account (T3, T5), total to pay with periods used and excluded accounts (T4, T5), left-out debit/unassigned (T3), rejected and currencies (T3), states and gating (T6), stored-card identity and holder (T3), tab survives updates (T5), account without credit cards (T3, T5), no alerts for unassigned cards (nothing planned, per spec non-goal).
- **Type consistency:** `Period`, `MoneyTotals`, `CardView`, `TabView`, `AccountView`, `TotalToPayResult` are defined in T2-T4 and used unchanged in T5-T6; `periodTabId`/`tabIdFor` share the `period:${end}` id.
- **Proportion:** signatures, test names with the spec's exact values and texts are specified; function bodies and markup are left to the implementer.
