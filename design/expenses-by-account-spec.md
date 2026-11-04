# Expenses grouped by account and statement period — Design

Date: 2026-11-03

Builds on `design/web-app-spec.md` (the web app) and `design/cards-spec.md` (accounts, cards and statement dates, already implemented on branch `cards-section`).

## Intent and why

When the owner opens **Gastos** the questions are: *how much have I spent so far in the current period*, *how much do I have to pay on each card*, and *how much do I have to pay in total*. Today the tab shows one table per person + card with no notion of accounts or statement periods. The Cards section already stores, for every account, the statement closing dates. This feature uses them: Gastos is reorganized as **account → period → card → purchases**, with subtotals and one **total to pay**.

The repository is public: no personal data (names, card digits, dates, project IDs) may be committed; all test data is made up.

## What the user sees

The **Gastos** tab (the Tarjetas tab does not change):

```
Total a pagar                                  $ 150.000,00
  Cuenta A · 16/10/2026 – 15/11/2026           $ 100.000,00
  Cuenta B · 20/10/2026 – 19/11/2026           $  50.000,00
  (Cuenta C: sin períodos con fechas cargadas, no suma)

Cuenta A                               [Sin periodo] [16/10 – 15/11] [16/09 – 15/10] [Viejos]
  Total del período seleccionado                $ 100.000,00
  ▸ JUAN  Crédito ····1234   3 compras         $  60.000,00
  ▸ ANA   Crédito ····5678   1 compra          $  40.000,00     (each one expands to the purchases table)

Cuenta B ...
```

### One section per account
- One section per existing account (name as title), ordered by name.
- Inside it a **period selector** made of tabs, with the periods **of that account only** (accounts close on different days and do not need to match).
- Below the selector: the **total of the selected period** for that account, then one collapsible group per **credit card** of that account (same look as today: holder, `Crédito ····last4`, number of purchases, subtotal; expanding shows the date / merchant / amount table, newest first).
- Every credit card of the account is listed, even with no purchases in the selected period (subtotal zero, "sin compras" note), so the user can see each card's amount to pay. Cards ordered by holder, then last 4 digits.

### Periods and tabs
- An account's stored closing dates, sorted ascending, are `c1 < c2 < … < cN`. **A period is the span between two consecutive closings: (c(i-1), c(i)] for i = 2..N**, i.e. from the day after the previous closing up to and **including** the closing day. The oldest closing `c1` only serves as the start of the next period; it has no tab of its own. With fewer than two closing dates the account has no periods yet.
- Tab for a period: label `dd/mm – dd/mm` (start day = previous closing + 1 day, end day = closing; show the year when it differs from the current year or when needed to be unambiguous — builder decides the exact format).
- **"Sin periodo"**: purchases **after** the account's latest closing date (the open, not yet closed period). If the account has **no closing dates at all**, *all* its purchases go here.
- **"Viejos"**: purchases **on or before** the oldest closing date `c1` (too old to belong to a defined period).
- Tab order: "Sin periodo", then periods from newest to oldest, then "Viejos". "Sin periodo" and "Viejos" tabs are shown **only if they contain at least one purchase**; except that an account with no closing dates always shows "Sin periodo" (with its empty state if it has no purchases).
- **Default tab** = the first one (the newest): "Sin periodo" when it exists, otherwise the latest period.
- The day of a purchase is its **Buenos Aires calendar day** (stored `purchaseDate` is midnight Buenos Aires; compare as a `YYYY-MM-DD` string to the stored closing dates, same time-zone rule as `design/cards-spec.md`). Every purchase of an account belongs to exactly one tab.

### Total a pagar
- A single number, always visible at the top of Gastos, **independent of the tabs selected** in each account.
- It is the sum, over every account, of the **latest period with loaded dates**, i.e. the period `(c(N-1), c(N)]` of the account. It does **not** use "Sin periodo", even when that tab has purchases.
- An account with fewer than two closing dates (no period yet) **does not contribute**; the total area says so (e.g. "Cuenta C: sin períodos con fechas cargadas, no suma").
- Next to the number it lists **which period of each account is being summed** (account name, period range, and that account's amount), as in the mock-up.
- Rejected purchases never count in any total (see below). Currencies are never mixed: totals are kept per currency, as today (`$ …` · `US$ …`).

## What is in and what is out
- **In:** purchases of **credit** cards that are stored in `cards` and whose `accountId` is an existing account.
- **Out of Gastos, entirely:** purchases of **debit** cards, and purchases of cards that have no account (not stored, or stored with an account that no longer exists). They do not appear in any table and do not count in any total. (The Tarjetas tab still lists the unassigned cards so they can be assigned.) This is what the owner asked for; the user accepted that those purchases are no longer visible in Gastos.
- Matching an expense to a card is by **last 4 digits + card type** (the card identity from `design/cards-spec.md`), not by holder. The holder shown for a card is the stored holder.
- A rejected purchase (`status: "rejected"`) keeps today's behavior: it is listed (greyed, with the "Rechazado" badge), counted in the number of purchases, but **not added to any subtotal or total**. A missing status counts as approved.

## Data
Reads only what the app already has: `expenses` (existing subscription), and `accounts`, `cards`, `cycles` (the cards subscription). No new collections, no rule changes, no writes. Because Gastos now needs the cards data, the cards subscription must be available for the Gastos tab too (shared with the Tarjetas tab, subscribed once, same authorization gate: never created before the user is authorized).

## States
- Loading while either the expenses or the cards data is loading.
- If either subscription fails (including permission denied) Gastos shows an error message (the data cannot be grouped without both); it never shows partial or wrong totals.
- No accounts: a message pointing the user to the Tarjetas tab to create one.
- An account with no purchases in the selected tab: a short empty state.

## Goals, non-goals, anti-goals
**Goals:** the three answers at a glance (spent so far in the current period, amount per card, total to pay); correct period assignment; consistent with the Cards section data.

**Non-goals:** due dates (loaded but not used); editing or deleting expenses; exports; charts; showing debit or unassigned purchases anywhere in Gastos; any warning about unassigned cards or incomplete states (the owner will design visual alerts for incomplete states in a later feature: for now Gastos shows nothing about them); changing the Tarjetas tab or any Firestore rules.

**Anti-goals (a failure even if it "works"):**
- A purchase that appears in two tabs, or in none, or the closing day assigned to the wrong period (off-by-one at the boundaries, or a time-zone shift moving a late-night purchase to the next day).
- A total to pay that includes "Sin periodo", a rejected purchase, a debit or unassigned card, an account without a period, or that silently adds different currencies.
- Totals shown while one of the data sources failed or is still loading.
- The cards source created before authorization.
- Personal data in the repository.

## Technology and structure
Same stack (React, TypeScript, shadcn/ui, Vitest, Testing Library). Reuse the existing `tabs`, `accordion`, `table`, `badge` components. As in previous features: pure logic tested on its own (period computation from closing dates, assigning a purchase to a tab, grouping by account → card, subtotals and the total to pay with the periods used) and components tested with fakes; UI texts in Argentine Spanish in `web/src/strings.ts`; English code and docs; TypeScript strict. Existing suites must stay green. The current `groupExpenses` / `ExpenseGroups` may be reused or replaced as the builder sees fit, provided the existing tests are kept meaningful (updated, not weakened).

## Calls made by me (the owner can change them)
- The closing day belongs to the period that ends on it (inclusive).
- Tab label format `dd/mm – dd/mm` (year when needed).
- "Sin periodo" and "Viejos" tabs only appear when they have purchases (except an account with no dates always shows "Sin periodo").
- Every credit card of an account is listed in the selected period, even with zero purchases.
- Accounts ordered by name; the total area lists one line per contributing account.
- Gastos shows an error rather than partial data when the cards or the expenses subscription fails.

- One group per **stored card** (last 4 + type), merging all its purchases whatever holder each expense carries; the shown holder is the stored one. (The old holder + card split goes away in this view.)
- Currencies: every amount is a per-currency map shown on one line joined with ` · `. "Total a pagar" has one line per currency present. A card with no purchases in the period shows "Sin compras" instead of an amount.
- The selected tab survives live data updates while it still exists; if it disappears the newest tab is selected.
- An account with no credit cards still shows its section and period selector, with a short "sin tarjetas de crédito" note, and contributes nothing to the total.
- Purchases with a malformed date or amount are not handled specially (the existing source behaves as today).
- "Latest period" for the total is always `(c(N-1), c(N)]` of the stored dates, regardless of today's date (stated by the owner); no clock is needed in the logic.

## Left to the builder
Layout details, exact label format, how the total area is laid out, module layout inside `web/src`, whether the account sections are accordions or plain sections, accessibility details, the shape of the pure functions.
