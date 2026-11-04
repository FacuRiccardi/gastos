# Cards section: accounts, cards and statement dates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Tarjetas" section in the web app where the two authorized people manage credit/debit accounts, assign cards to accounts and people, and load the closing and due dates of each statement period.

**Architecture:** Three new top-level Firestore collections (`accounts`, `cards`, `cycles`) with strict write rules (everything else stays as it is); a small data layer behind injected interfaces (`CardsSource`, `CardsApi`) tested against the Firestore emulator with the real rules; pure logic (date parsing, bulk-dates parsing, detection of unassigned cards) tested on its own; React components tested with fakes.

**Tech Stack:** Same as the web app (React, TypeScript, shadcn/ui, Firebase modular SDK, Vitest, Testing Library, `@firebase/rules-unit-testing` + emulator).

**Spec:** `design/cards-spec.md` (builds on `design/web-app-spec.md`)

## Global Constraints

- The repository is **public**: no personal data (names, real card digits, real dates), project IDs or Firebase config; all test data is made up.
- Expenses and `state/sync` stay exactly as protected today; the new collections are writable only by `isHousehold()` and only with the validations in the spec.
- Calendar dates are stored as `YYYY-MM-DD` strings; the UI shows `dd/mm/yyyy`. Closing date required, due date optional (`null`).
- IDs: `cards/{last4}_{type}`, `cycles/{accountId}_{closingDate}`; accounts get generated IDs. `cycles` are immutable (no updates); cards may only change `holder` and `accountId`.
- New shadcn components must be added by following the **official documentation at the time of the work** (https://ui.shadcn.com/docs/components), not from memory.
- `web/src/cards/types.ts`, `cardsApi.ts`, `firestoreCards.ts` and `web/src/lib/dates.ts` must not use the `@/` alias (they are imported by the root emulator tests); if a second copy of the `firebase` package is loaded there, alias it to one copy in the root `vitest.config.js`.
- UI texts in Argentine Spanish in `web/src/strings.ts`; TypeScript strict; English code and docs.
- The user's global npm registry is private: `web/` and the root keep their own `.npmrc` with the public registry; the lockfiles must not resolve to any other host.
- Git: work on a branch `cards-section` created from `web-app`; commits with author `FacuRiccardi <FacuRiccardi@users.noreply.github.com>` (via `git -c user.name=... -c user.email=...`) ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- All existing suites stay green: `npm test`, `npm run test:store`, `npm run test:rules`, `npm --prefix web test`, `npm run web:build`.

## Review Focus

1. A document with an extra field, a missing field, a wrong type or a malformed date is rejected by the **rules** for each new collection, not only by the UI (Task 3).
2. Writing over an existing cycle (same closing date, same account) is rejected by the rules, and the UI shows a duplicate message (Tasks 3, 7).
3. Impossible dates are rejected (`31/02/2026`, `29/02/2027`, `15/13/2026`) and a leap day is accepted (`29/02/2028`); a due date before the closing date is rejected (Tasks 1, 2, 3, 7).
4. Deleting an account removes its cycles and cards in one batch and leaves other accounts alone; a card whose account no longer exists is shown as "without an account" (Tasks 2, 4, 6).
5. Bulk loading is all-or-nothing: one invalid line, or one line that repeats a stored closing date, writes nothing (Tasks 2, 4, 7).
6. An unauthorized or signed-out user never creates the cards source or the cards API (Task 8).

## File Structure

```
firestore.rules                              + accounts, cards, cycles
test/rules.cards.test.js                     rules tests for the new collections (emulator)
test/rules.cards-firestore.test.ts           data layer against the emulator with the real rules
web/src/lib/dates.ts (+ test)                calendar date helpers
web/src/cards/types.ts                       Account, Card, Cycle, key helpers
web/src/cards/cardLogic.ts (+ test)          findUnassignedCards, parseCyclesText, normalizeOwner
web/src/cards/cardsApi.ts                    CardsData, CardsSource, CardsApi interfaces
web/src/cards/firestoreCards.ts              Firestore implementation
web/src/cards/useCards.ts (+ test)           subscription hook
web/src/cards/CardsScreen.tsx (+ test)       accounts, cards, unassigned cards
web/src/cards/CyclesSection.tsx (+ test)     dates list, add form, bulk form
web/src/App.tsx, main.tsx, strings.ts        navigation and wiring
```

---

### Task 1: Setup cleanup and date helpers

**Files:** Create `web/src/lib/dates.ts`, `web/src/lib/dates.test.ts`; Modify `.gitignore` (add `.firebase/`)

**Interfaces:**
- Produces: `isValidDateString(value: string): boolean` (a real calendar date written `YYYY-MM-DD`), `parseDisplayDate(text: string): string | null` (`dd/mm/yyyy`, one or two digits for day and month, surrounding spaces ignored → `YYYY-MM-DD`, or `null`), `formatCalendarDate(value: string): string` (`YYYY-MM-DD` → `dd/mm/yyyy`).

- [ ] **Step 1:** Create branch `cards-section` from `web-app`. The working tree has an accidental uncommitted change that adds `"card-expenses": "file:.."` to `web/package.json` and `web/package-lock.json`: revert both files (`git checkout -- web/package.json web/package-lock.json`) and run `npm --prefix web install` to resync; add `.firebase/` to `.gitignore`.
- [ ] **Step 2: Tests:** `parseDisplayDate parses a valid date` (`15/03/2026` → `2026-03-15`, `5/3/2026` → `2026-03-05`, `" 15/03/2026 "`), `accepts a leap day` (`29/02/2028` → `2028-02-29`), `rejects impossible dates` (`31/02/2026`, `29/02/2027`, `15/13/2026`, `00/01/2026`, `32/01/2026` → `null`), `rejects other formats` (`15-03-2026`, `2026-03-15`, `15/03/26`, empty → `null`), `isValidDateString` (`2026-03-15` true; `2026-02-31`, `2026-3-5`, `abc` false), `formatCalendarDate` (`2026-03-05` → `05/03/2026`).
- [ ] **Step 3:** Run `npm --prefix web test -- dates`; expected FAIL. **Step 4:** implement (no `Date` time-zone dependence: validate with calendar arithmetic or `Date.UTC`). **Step 5:** PASS; commit `chore: ignore .firebase; feat(web): calendar date helpers`.

### Task 2: Types and card logic

**Files:** Create `web/src/cards/types.ts`, `web/src/cards/cardLogic.ts`, `web/src/cards/cardLogic.test.ts`

**Interfaces:**
- `types.ts` (no `@/` imports): `Account = { id: string; name: string; owner: string }`, `Card = { last4: string; type: "credit" | "debit"; holder: string; accountId: string }`, `Cycle = { accountId: string; closingDate: string; dueDate: string | null }`, `NewCycle = { closingDate: string; dueDate: string | null }`, `DetectedCard = { last4: string; type: "credit" | "debit"; holder: string }`, `cardKey(c: { last4: string; type: string }): string` (`1234_credit`), `cycleKey(accountId: string, closingDate: string): string`.
- `cardLogic.ts`:
  - `findUnassignedCards(expenses: Expense[], cards: Card[], accounts: Account[]): DetectedCard[]` — distinct last 4 + type found in the expenses (holder taken from the most recent expense of that card) that have no stored card, **plus** stored cards whose `accountId` matches no existing account (using their stored holder); a stored card whose account exists is not returned; sorted by holder then last 4.
  - `parseCyclesText(text: string, existingClosingDates: string[]): { cycles: NewCycle[]; errors: { line: number; code: "format" | "date" | "dueBeforeClosing" | "duplicateInText" | "duplicateStored" }[] }` — one cycle per line, `dd/mm/yyyy dd/mm/yyyy` or `dd/mm/yyyy`, blank lines ignored, `line` is 1-based; a line with errors is not part of `cycles`.
  - `normalizeOwner(name: string): string` — trimmed, inner spaces collapsed, upper case in `es-AR`.

- [ ] **Step 1: Tests** (made-up data): `findUnassignedCards` — `detects each distinct card once`, `ignores holder differences when matching a stored card`, `uses the holder of the most recent expense`, `does not return a card stored under an existing account`, `returns a stored card whose account does not exist` (Review Focus 4), `sorts by holder then last 4`. `parseCyclesText` — `parses closing and due dates`, `accepts a line with only a closing date (dueDate null)`, `ignores blank lines and reports 1-based line numbers`, `reports format and impossible-date errors` (`31/02/2026`, `abc`, three dates on a line), `reports a due date before the closing date`, `reports a repeated closing date within the text`, `reports a closing date that is already stored`, `accepts a leap day` (Review Focus 3, 5). `normalizeOwner` — `trims, collapses spaces and upper-cases` (`" juan  "` → `JUAN`, `"ñandú"` → `ÑANDÚ`).
- [ ] **Step 2:** Run `npm --prefix web test -- cardLogic`; expected FAIL. **Step 3:** implement (use `parseDisplayDate` from Task 1). **Step 4:** PASS. Commit `feat(web): card logic and types`.

### Task 3: Firestore rules for the new collections

**Files:** Modify `firestore.rules`, `package.json` (scripts), create `test/rules.cards.test.js`

**Interfaces:** Rules as in the spec: for `accounts`, `cards`, `cycles` — read: `isHousehold()`; create: exactly the fields, right types and sizes, dates matching `^\d{4}-\d{2}-\d{2}$`, due date (when not null) not before the closing date, document ID equal to the fields (`cards`: `last4_type`; `cycles`: `accountId_closingDate`), referenced account exists; update: `accounts` may change `name`/`owner`, `cards` only `holder`/`accountId` (same checks, account exists), `cycles` never; delete: `isHousehold()`. `expenses` and `state` unchanged. Scripts: `test:rules` runs every `test/rules*` file; `test` excludes `test/rules*`.

- [ ] **Step 1: Tests** (`authenticatedContext` with `{ email_verified: true, household: true }`; seed an account with rules disabled): for each collection, `an authorized person can create a valid document`, `signed out, without the claim or with an unverified email is denied`, `extra field is denied`, `missing field is denied`, `wrong type is denied`, `name or owner longer than 40 characters or empty is denied`; `cards`: `a document ID that differs from last4_type is denied`, `last4 that is not 4 digits or an unknown type is denied`, `a card for a missing account is denied`, `update may change holder and accountId but not last4 or type`, `delete is allowed`; `cycles`: `a malformed date is denied`, `a due date before the closing date is denied`, `a null due date is allowed`, `a document ID that differs from accountId_closingDate is denied`, `a cycle for a missing account is denied`, `updating an existing cycle is denied and writing over its ID is denied` (Review Focus 2), `delete is allowed`; `accounts`: `update of name and owner is allowed`, `delete is allowed`. Also `the existing expenses and state/sync rules still hold` (reads/writes denied as before).
- [ ] **Step 2:** `npm run test:rules`; expected: new tests FAIL (collections are denied by the catch-all). **Step 3:** write the rules. **Step 4:** `npm run test:rules` PASS (old and new), `npm test`, `npm run test:store` green. Commit `feat: Firestore rules for accounts, cards and cycles`.

### Task 4: Data layer

**Files:** Create `web/src/cards/cardsApi.ts`, `web/src/cards/firestoreCards.ts`, `test/rules.cards-firestore.test.ts`; Modify `vitest.config.js` (include `test/**/*.test.{js,ts}`; dedupe/alias `firebase` to the root copy if needed)

**Interfaces:**
- `cardsApi.ts` (no `@/` imports): `CardsData = { accounts: Account[]; cards: Card[]; cycles: Cycle[] }`; `interface CardsSource { subscribe(onData: (data: CardsData) => void, onError: (error: Error) => void): () => void }`; `interface CardsApi { createAccount(input: { name: string; owner: string }): Promise<string>; updateAccount(id: string, input: { name: string; owner: string }): Promise<void>; deleteAccount(id: string): Promise<void>; saveCard(card: Card): Promise<void>; removeCard(card: { last4: string; type: "credit" | "debit" }): Promise<void>; addCycles(accountId: string, cycles: NewCycle[]): Promise<void>; deleteCycle(accountId: string, closingDate: string): Promise<void> }`.
- `firestoreCards.ts`: `createFirestoreCardsSource(db: Firestore): CardsSource` (listens to the three collections and emits once all three delivered; errors propagate), `createFirestoreCardsApi(db: Firestore): CardsApi` (`saveCard` writes with ID `last4_type`; `addCycles` is **one batch** with IDs `accountId_closingDate`; `deleteAccount` is **one batch** deleting the account, its cycles and its cards).

- [ ] **Step 1: Tests** in `test/rules.cards-firestore.test.ts` using the emulator with the real `firestore.rules` and `testEnv.authenticatedContext(...).firestore()` as `db`: `createAccount returns an id and the account arrives through the source`, `saveCard creates last4_type and a second save changes holder and account`, `removeCard deletes the card`, `addCycles creates all cycles`, `addCycles writes nothing when one cycle is rejected by the rules` (Review Focus 5), `addCycles rejects a closing date that already exists and keeps the stored due date` (Review Focus 2), `deleteCycle removes it`, `deleteAccount removes its cycles and cards in one batch and leaves another account untouched` (Review Focus 4), `a person without the claim gets a permission error from the source`.
- [ ] **Step 2:** `npm run test:rules`; expected FAIL (modules missing). **Step 3:** implement the interfaces and the Firestore code. **Step 4:** PASS; `npm --prefix web run build` clean. Commit `feat(web): cards data layer`.

### Task 5: `useCards` hook

**Files:** Create `web/src/cards/useCards.ts`, `web/src/cards/useCards.test.tsx`

**Interfaces:** `useCards(source: CardsSource): { status: "loading" | "ready" | "error"; data: CardsData; error: string | null }` (same behavior and error text style as `useExpenses`; add `strings.cards.error`).

- [ ] **Step 1: Tests:** `is loading and then ready with the data`, `exposes an error when the source fails and drops the data`, `unsubscribes on unmount`. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. Commit `feat(web): useCards hook`.

### Task 6: Accounts and cards screen

**Files:** Create `web/src/cards/CardsScreen.tsx`, `web/src/cards/CardsScreen.test.tsx`; Modify `web/src/strings.ts`; add the needed shadcn components (likely input, label, select, dialog, alert-dialog) following the official docs.

**Interfaces:** `CardsScreen({ expenses, data, api }: { expenses: Expense[]; data: CardsData; api: CardsApi })` — an account section per account (name, owner, its cards with type, `····last4` and holder, buttons to change/remove a card, edit/delete the account), a "without an account" list from `findUnassignedCards` with an account selector, and a "new account" form. It renders `<CyclesSection>` (Task 7) inside each account; until Task 7 exists, render a placeholder in its place. Owner names go through `normalizeOwner`. Failed API calls show an alert message.

- [ ] **Step 1: Tests** (fake `CardsApi` with `vi.fn()` methods): `shows an empty state and offers to create an account`, `creating an account calls createAccount with the name and the owner in upper case`, `an account lists its cards with type, last 4 digits and holder`, `detected cards without an account are listed and assigning one calls saveCard with the holder taken from the expenses`, `a card whose account does not exist is listed as without an account` (Review Focus 4), `changing a card changes its holder and account but keeps last4 and type`, `removing a card calls removeCard`, `editing an account calls updateAccount`, `deleting an account asks for confirmation, cancel does nothing and confirm calls deleteAccount`, `shows an error message when an api call fails`.
- [ ] **Step 2:** `npm --prefix web test -- CardsScreen`; expected FAIL. **Step 3:** implement. **Step 4:** PASS. Commit `feat(web): accounts and cards screen`.

### Task 7: Statement dates (cycles) section

**Files:** Create `web/src/cards/CyclesSection.tsx`, `web/src/cards/CyclesSection.test.tsx`; Modify `CardsScreen.tsx` (use it), `strings.ts`.

**Interfaces:** `CyclesSection({ account, cycles, api }: { account: Account; cycles: Cycle[]; api: Pick<CardsApi, "addCycles" | "deleteCycle"> })` — lists only the cycles of that account as `dd/mm/yyyy` (closing, due or "—") ordered by closing date, an "add one" form (two `<input type="date">`), a "load several" form (textarea in the `dd/mm/yyyy dd/mm/yyyy` format) and a delete button per row. Validation uses `parseCyclesText`; error messages come from `strings.cards.cycleErrors` keyed by error code.

- [ ] **Step 1: Tests:** `lists the cycles of the account only, ordered by closing date, formatted dd/mm/yyyy`, `adding one cycle calls addCycles with YYYY-MM-DD dates and an optional due date`, `a closing date that already exists is rejected with a message and nothing is written` (Review Focus 2), `a due date before the closing date is rejected` (Review Focus 3), `bulk: valid lines call addCycles once with all the cycles`, `bulk: one invalid line lists the invalid lines and writes nothing` (Review Focus 5), `bulk: a line that repeats a stored closing date fails the whole batch`, `deleting a cycle calls deleteCycle`, `an api failure shows an error message`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** `npm --prefix web test` all green. Commit `feat(web): statement dates section`.

### Task 8: Navigation and wiring

**Files:** Modify `web/src/App.tsx`, `web/src/main.tsx`, `web/src/App.test.tsx`, `web/src/strings.ts`; add the shadcn `tabs` component following the docs.

**Interfaces:** `App` props gain `createCardsSource: () => CardsSource` and `createCardsApi: () => CardsApi`. The authorized view has two tabs, "Gastos" (as today) and "Tarjetas" (`useCards(source)` + `CardsScreen` with the same expenses already loaded); the expenses subscription is shared, not duplicated. `main.tsx` passes `createFirestoreCardsSource(db)` and `createFirestoreCardsApi(db)`.

- [ ] **Step 1: Tests** (extend `App.test.tsx` with fake cards source/api): `never creates the cards source or the cards api unless authorized` (Review Focus 6: loading, signed out, unauthorized), `shows the Gastos tab by default and switches to Tarjetas`, `the Tarjetas tab shows the accounts from the source`, `shows an error message in the Tarjetas tab when its subscription fails (permission-denied)`, `the expenses are subscribed once, not once per tab`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** `npm --prefix web test` and `npm run web:build` green. Commit `feat(web): Tarjetas tab and wiring`.

### Task 9: Documentation and full verification

**Files:** Modify `docs/privacy.html`, `README.md`, `RUNBOOK.md`

- [ ] **Step 1:** `docs/privacy.html` ("What data it stores") now also lists account names, the assignment of cards to people and statement closing/due dates; update the "Last updated" date. README: mention the Cards section and the new collections in the layout/data sections; RUNBOOK: a short "Cards section" note that the rules must be redeployed with `npm run web:deploy -- --project <project-id>` and a manual check that a third (unauthorized) account cannot write to `accounts`, `cards` or `cycles` (same token technique as step 7 of the web app section, with a `PATCH`/`POST` request expecting 403).
- [ ] **Step 2:** Run everything: `npm test`, `npm run test:store`, `npm run test:rules`, `npm --prefix web test`, `npm run web:build`; expected all green. Scan the staged tree for personal data (`git grep --cached` for emails, project IDs, real card digits and names); expected none besides the intentional contact email.
- [ ] **Step 3:** Commit `docs: Cards section`.

---

## Self-review (done)

- **Spec coverage:** accounts/cards/cycles model and IDs (T2, T3, T4), rules incl. immutability of cycles and of `last4`/`type` (T3), unassigned detection by last 4 + type and orphans (T2), holder/account change and removal (T6), single and bulk dates with all-or-nothing and duplicates (T2, T4, T7), batched account delete (T4, T6), navigation with shared expenses subscription and gating (T8), privacy/README/runbook (T9).
- **Type consistency:** `Account/Card/Cycle/NewCycle/DetectedCard` (T2) are the types used by `CardsApi` (T4), `useCards` (T5) and the components (T6, T7); `parseCyclesText` (T2) feeds T7; `CardsData` (T4) feeds T5, T6, T8.
- **Proportion:** interfaces, rules and test names are specified; component markup and function bodies are left to the implementer.
