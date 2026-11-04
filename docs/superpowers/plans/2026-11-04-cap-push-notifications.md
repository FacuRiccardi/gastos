# Spending-cap push notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an ingested purchase makes the current period's spending reach a new threshold of the spending cap, send an FCM push to both Android phones and show a per-user dismissable alert on the home screen.

**Architecture:** After ingestion saves at least one new expense, the Cloud Function (`src/`) recomputes the current period's spending (a JS port of the web's period logic, with the latest TC for USD), compares it with the cap, raises a per-month `capAlerts/{YYYY-MM}` level in a transaction and then sends the push. The web app registers FCM tokens in `pushTokens`, and the home screen subscribes to `capAlerts/{month}` plus the user's own dismissal document.

**Tech Stack:** Node 22 + Vitest + `@google-cloud/firestore` + `firebase-admin` (Messaging) in `src/`; React 19 + TS + Firebase JS SDK 13 (Messaging) in `web/`; Terraform; Firestore rules tested with the emulator.

**Spec:** `docs/superpowers/specs/2026-11-04-cap-push-notifications-design.md`

Work on a feature branch (the repo merges feature branches). Backend tests: `npm test`; emulator tests: `npm run test:store`, `npm run test:rules`; web tests: `npm --prefix web test`; web build/lint: `npm --prefix web run build`, `npm --prefix web run lint`.

## Global Constraints

- Ladder: 50, 75, 100, then every 10 above (110, 120, ...). Level of percentage `p` = highest step `<= p`; below 50 none.
- Percentage = period total in pesos × 100 / cap amount. Cap in force = `capFor(month, caps)` (the month's own, else latest earlier with amount > 0). No cap → nothing happens and nothing is written.
- Period total = same as the home screen's `current` group: credit cards of existing accounts only (matched by `last4` + `type`), `status: 'rejected'` excluded, ARS + USD × **latest loaded TC** (highest month key in `exchangeRates` with rate > 0; none → 0), other currencies left out. Month of the group = month of the latest closing date among the accounts' current periods (else `today.slice(0,7)`). "Today" and purchase days are Buenos Aires days (UTC-3).
- `capAlerts/{month}.lastLevel` only ever goes up; it is raised **before** sending. A cap change alone never sends anything. No backfill suppression.
- A failure in the cap check or in FCM is logged with `logger.error` and swallowed: ingestion's result and HTTP status do not change.
- Push: Android Chrome via FCM web push, tap opens `/`. Text in Spanish: title `Tope de gasto`, body `Llegaste al {level}% del tope`. iOS out of scope.
- In-app alert: Spanish, separate from the existing home alerts, dismissable per user, stored in Firestore (not browser storage); shows the stored `total` at the moment of the level. Example: `Superaste el 50% de tu tope: vas gastando $ 1.000.000,00` (use `formatMoney(total, 'ARS')`).
- Collections (exact): `accounts`, `cards`, `cycles`, `exchangeRates` (doc id = month, field `rate`), `spendingCaps` (doc id = month, field `amount`), `expenses`, new `capAlerts/{month}` (+ subcollection `dismissals/{uid}`), new `pushTokens/{token}`.

## Review Focus

- Purchase arrives with no cap defined for the month: nothing sent, nothing written (Task 5).
- Today is exactly a closing day / a purchase on the closing day: belongs to the period ending that day (Task 2).
- Account with no cycles loaded (only the "open" tab) and account whose today falls after its last closing (Task 2).
- Two ingestion batches racing for the same level: only one announces (Task 4).
- Zero registered tokens, invalid tokens, and FCM throwing: alert document still written, tokens cleaned, ingestion unaffected (Tasks 3, 5, 6).

---

### Task 1: Level ladder and Buenos Aires dates

**Files:**
- Create: `src/capLevel.js`, `src/dates.js`
- Test: `test/capLevel.test.js`, `test/dates.test.js`

**Interfaces:**
- Produces: `levelFor(percent: number): number | null`; `buenosAiresDay(date: Date): string` (`YYYY-MM-DD`); `addDays(day: string, days: number): string`.

- [ ] **Step 1: Write failing tests** in `test/capLevel.test.js` for `levelFor`: `49.99→null`, `50→50`, `74.99→50`, `75→75`, `99.99→75`, `100→100`, `109.99→100`, `110→110`, `125→120`, `0→null`; and a float case: `levelFor(2900*100/1000) === 290`. In `test/dates.test.js`: `buenosAiresDay(new Date('2026-11-04T02:30:00Z')) === '2026-11-03'`, `buenosAiresDay(new Date('2026-11-04T03:00:00Z')) === '2026-11-04'`, `addDays('2026-02-28', 1) === '2026-03-01'`.
- [ ] **Step 2: Run** `npx vitest run test/capLevel.test.js test/dates.test.js`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both modules. `levelFor` rounds `percent` to 6 decimals before comparing, to absorb float error. `buenosAiresDay` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })` as `web/src/lib/dates.ts` does; `addDays` uses UTC calendar arithmetic as in that file.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(caps): threshold ladder and Buenos Aires date helpers`.

### Task 2: Current-period spend (port of the web logic) with parity test

**Files:**
- Create: `src/periodSpend.js`
- Modify: `vitest.config.js` (add alias `@` → `web/src` so a root test can import web modules)
- Test: `test/periodSpend.test.js`, `test/periodSpend.parity.test.js`

**Interfaces:**
- Consumes: `addDays`, `buenosAiresDay` from `src/dates.js`.
- Produces:
  - `latestRate(rates: Record<string, number>): number` (0 when none > 0)
  - `capFor(month: string, caps: Record<string, number>): { amount: number; from: string } | null`
  - `currentPeriodSpend(input: { expenses: {purchaseDate: Date; amount: number; currency: string; cardLast4: string; cardType: string; status?: string}[]; accounts: {id: string}[]; cards: {last4: string; type: string; accountId: string}[]; cycles: {accountId: string; closingDate: string}[]; rates: Record<string, number>; today: string }): { month: string; total: number } | null` — `null` exactly when the web's `buildHomePeriods(...).current` is `null`. Totals rounded to 2 decimals as the web does.

- [ ] **Step 1: Write failing unit tests** (`test/periodSpend.test.js`), one `it` each, building small inputs:
  - closing dates `2026-10-05`, `2026-11-05`; today `2026-11-04`; purchase on `2026-10-06` and one on `2026-11-05` both counted in the period ending `2026-11-05` (closing day belongs to the ending period); purchase `2026-11-06` not counted; month `'2026-11'`.
  - today `2026-11-05` (closing day) → still the period ending `2026-11-05`.
  - rejected purchase and debit card and card of another/unknown account are excluded.
  - USD uses the latest rate: `rates = {'2026-08': 1000, '2026-09': 1200}`, `USD 10` in an `2026-11` period → `12000` added; with `rates = {}` → USD adds 0; `EUR` never counts.
  - account with no cycles: its purchases count (open tab); account whose today is after its last closing: only purchases after the closing count (open tab), and it does not influence `month`.
  - two accounts with different closings: `month` = month of the latest period end.
  - no accounts → `null`.
  - `capFor('2026-12', {'2026-10': 500})` → `{amount: 500, from: '2026-10'}`; own month wins; amount 0 earlier is skipped; none → `null`.
  - `latestRate({'2026-01': 900, '2026-03': 0})` → `900`.
- [ ] **Step 2: Run** `npx vitest run test/periodSpend.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/periodSpend.js` mirroring `buildPeriods`/`tabIdFor`/`buildAccountViews`/`buildHomePeriods`/`makeGroup`/`capFor` (`web/src/expenses/statements.ts`, `web/src/home/homePeriods.ts`) but only for the current tab, and with the latest rate instead of `rateFor`. Purchase day = `buenosAiresDay(purchaseDate)`.
- [ ] **Step 4: Run** the unit tests. Expected: PASS.
- [ ] **Step 5: Write the parity test** `test/periodSpend.parity.test.js`: add the `@` alias in `vitest.config.js`; import web `buildAccountViews`, `buildHomePeriods` and run both implementations over the same fixture set (several accounts, mixed currencies, rejected, closing-day boundaries, an account without cycles, a month with no periods). Assert `currentPeriodSpend(...)` equals `{month: g.month, total: g.total}` (or `null`) where web is called with `rates = { [latestRateMonth]: latestRate }` (a single-entry map, so the web's `rateFor` returns the latest rate for any month). Add one test that pins the intended difference: with `rates = {'2026-10': 1000, '2026-11': 1500, '2026-12': 1800}` and a USD purchase in a period of month `2026-11`, the web called with the full map converts at 1500 while `currentPeriodSpend` converts at 1800.
- [ ] **Step 6: Run** `npm test`. Expected: PASS (if importing the web modules from the root fails because of a browser-only import in the chain, fix the alias/import in the test only; do not change web modules).
- [ ] **Step 7: Commit** `feat(caps): backend port of the current-period spend`.

### Task 3: Firestore rules for `capAlerts` and `pushTokens`

**Files:**
- Modify: `firestore.rules`
- Test: `test/rules.pushcaps.test.js` (same harness as `test/rules.caps.test.js`)

**Interfaces:**
- Produces: household members can **read** `capAlerts/{month}` and `capAlerts/{month}/dismissals/{uid}` only for their own `uid`, **write** `capAlerts/{month}/dismissals/{uid}` only for their own uid with `{ level: number }` (keys exactly `['level']`, `level > 0`); nobody writes `capAlerts/{month}` from a client; `pushTokens/{token}`: a household member can create/update/delete when `request.resource.data.uid == request.auth.uid` and keys ⊆ `['uid','createdAt','updatedAt']`, and read only documents whose `uid` is their own; non-household denied everywhere.

- [ ] **Step 1: Write failing tests**: household reads `capAlerts/2026-11` (seeded with `testEnv.withSecurityRulesDisabled`) succeeds, writing it fails; user1 writes `capAlerts/2026-11/dismissals/user1 {level: 50}` succeeds, writing `.../dismissals/user2` fails, reading `.../dismissals/user2` fails, `{level: 50, extra: 1}` fails, `{level: 'x'}` fails; `pushTokens/abc {uid:'user1', createdAt, updatedAt}` created by user1 succeeds, with `uid:'user2'` fails, reading another user's token fails; a stranger (no `household` claim) fails on all.
- [ ] **Step 2: Run** `npm run test:rules`. Expected: FAIL on the new file.
- [ ] **Step 3: Add the rules** to `firestore.rules` using the existing `isHousehold()` and the month regex used for `spendingCaps`.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: PASS (all rules tests).
- [ ] **Step 5: Commit** `feat(caps): rules for capAlerts, dismissals and pushTokens`.

### Task 4: Store methods

**Files:**
- Modify: `src/store.js`
- Test: `test/store.test.js` (emulator; follow its existing setup)

**Interfaces:**
- Produces on the object returned by `createStore(db)`:
  - `getCapContext(): Promise<{ expenses: ExpenseRow[]; accounts: {id: string}[]; cards: {last4: string; type: string; accountId: string}[]; cycles: {accountId: string; closingDate: string}[]; rates: Record<string, number>; caps: Record<string, number> }>` — `expenses[i].purchaseDate` is a `Date`; `rates` from `exchangeRates` (`rate`), `caps` from `spendingCaps` (`amount`).
  - `raiseCapAlert(month: string, alert: { level: number; total: number; cap: number }): Promise<boolean>` — transaction; `true` and writes `{ lastLevel, total, cap, announcedAt }` only when `level` is greater than the stored `lastLevel` (or none); otherwise `false` and writes nothing.
  - `listPushTokens(): Promise<string[]>`; `deletePushTokens(tokens: string[]): Promise<void>`.

- [ ] **Step 1: Write failing emulator tests**: `raiseCapAlert('2026-11', {level: 50, total: 500, cap: 1000})` → `true`; again with level 50 → `false`; with 75 → `true` and doc has `lastLevel: 75, total, cap`; with 50 after 75 → `false` and doc unchanged; two concurrent `Promise.all` calls with level 75 on a fresh month → exactly one `true`. `getCapContext` returns the seeded documents with `purchaseDate` as `Date` and the `rates`/`caps` maps. `listPushTokens`/`deletePushTokens` round trip.
- [ ] **Step 2: Run** `npm run test:store`. Expected: FAIL.
- [ ] **Step 3: Implement** the four methods (`runTransaction` for `raiseCapAlert`; `db.getAll`/`collection().get()` for the context — reading the whole `expenses` collection is acceptable at household volume).
- [ ] **Step 4: Run** `npm run test:store`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(caps): store methods for cap context, alert level and push tokens`.

### Task 5: Notifier and cap-alert orchestration

**Files:**
- Create: `src/notifier.js`, `src/capAlerts.js`
- Test: `test/notifier.test.js`, `test/capAlerts.test.js`

**Interfaces:**
- Consumes: Task 1–4 interfaces.
- Produces:
  - `createNotifier({ store, messaging, logger }): { notifyLevel(level: number): Promise<void> }` — gets tokens from `store.listPushTokens()`; none → returns without calling FCM; otherwise `messaging.sendEachForMulticast({ tokens, data: { title: 'Tope de gasto', body: 'Llegaste al {level}% del tope', url: '/' }, android: { priority: 'high' }, webpush: { headers: { Urgency: 'high' } } })` (data-only; the service worker builds the notification) and deletes via `store.deletePushTokens` the tokens whose response error code is `messaging/registration-token-not-registered` or `messaging/invalid-registration-token`.
  - `createCapAlerts({ store, notifier, logger, now?: () => Date }): { check(): Promise<{ level: number | null; announced: boolean }> }` — flow: `store.getCapContext()` → `currentPeriodSpend` (today = `buenosAiresDay(now())`) → `capFor(month, caps)` → percent `total*100/cap.amount` → `levelFor` → if a level: `store.raiseCapAlert(month, {level, total, cap: cap.amount})` → if it returned `true`: `notifier.notifyLevel(level)` inside try/catch that logs `logger.error({ message })` and does not rethrow. The alert document is written regardless of the push outcome.

- [ ] **Step 1: Write failing tests** with fakes (`vi.fn`):
  - notifier: no tokens → `sendEachForMulticast` not called; payload equals the object above for level 75; an `unregistered` error response deletes only that token; a thrown `sendEachForMulticast` rejects (the orchestrator is what swallows it).
  - capAlerts (fake store keeping `lastLevel` per month like Task 4): 40%→80% in one check → `raiseCapAlert` called once with level 75 and one notification (not 50 and 75); second check with same data → `announced: false`, no second notification; total drops (rejected expense added) after being at 100 → no notification and `lastLevel` stays; cap changed 1000→2000 and check with the same spend → no notification; cap then lowered to 500 so spend is 130% → one notification with level 130; no cap for the month → `raiseCapAlert` and `notifyLevel` not called; USD with no rates counts 0; notifier throwing → `check()` resolves, `logger.error` called, `raiseCapAlert` was still called with the level.
- [ ] **Step 2: Run** `npx vitest run test/notifier.test.js test/capAlerts.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(caps): notifier and cap-alert check`.

### Task 6: Wire into ingestion and the Function

**Files:**
- Modify: `src/sync.js` (`processIds`), `src/index.js` (`deps()`), `package.json` + `package-lock.json` (move `firebase-admin` from devDependencies to dependencies)
- Test: `test/sync.test.js`, `test/index.test.js`

**Interfaces:**
- Consumes: `createCapAlerts`, `createNotifier`, store from Tasks 4–5.
- Produces: `processIds(deps, ids)` calls `deps.capAlerts.check()` once, after the loop, only when `saved > 0` and `deps.capAlerts` exists; any error is logged via `deps.logger.error({ message: ... })` and swallowed. `deps()` in `index.js` builds `capAlerts` with `initializeApp()`/`getMessaging()` from `firebase-admin`.

- [ ] **Step 1: Write failing tests** in `test/sync.test.js`: batch of 3 new messages → `check` called exactly once; batch where `saveExpense` returns `false` for all (duplicate delivery) → not called; `check` rejecting → `processNotification` still resolves with the same `{ saved }` and `logger.error` was called; `renewWatch`/`reconcile` that saves a missed purchase also calls it. In `test/index.test.js`: a `check` that throws leaves the handler answering `204`.
- [ ] **Step 2: Run** `npx vitest run test/sync.test.js test/index.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the wiring; run `npm install --package-lock-only` after moving `firebase-admin` to `dependencies`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(caps): run the cap check after ingestion`.

### Task 7: Infrastructure and runbook

**Files:**
- Modify: `terraform/main.tf`, `RUNBOOK.md`, `web/.env.example`, `web/.env.emulator`

- [ ] **Step 1:** In `terraform/main.tf` add `"fcm.googleapis.com"` to the APIs list and a `google_project_iam_member` giving `roles/firebasecloudmessaging.admin` to `local.runtime_sa` (same style as `functions_firestore`).
- [ ] **Step 2:** `terraform -chdir=terraform validate`. Expected: `Success! The configuration is valid.`
- [ ] **Step 3:** Add to `web/.env.example` `VITE_FIREBASE_MESSAGING_SENDER_ID=` and `VITE_FIREBASE_VAPID_KEY=` (Firebase console → Project settings → Cloud Messaging → Web Push certificates → generate key pair); fake values in `web/.env.emulator`. Document both in `RUNBOOK.md`, plus the new deploy order (`terraform apply`, then `npm run web:deploy` for hosting + rules, then the Function via the existing flow) and a manual verification section: open the app on each phone and accept the permission; write a lower cap; ingest/forward a purchase; confirm the push arrives, tapping opens the home screen, the home alert shows on both phones and dismissing on one leaves it on the other.
- [ ] **Step 4: Commit** `chore(caps): enable FCM, runtime permission and runbook`.

### Task 8: Web data layer for the in-app alert

**Files:**
- Create: `web/src/home/capAlertApi.ts`, `web/src/home/firestoreCapAlerts.ts`, `web/src/home/useCapAlert.ts`
- Modify: `web/src/App.tsx` (new props `createCapAlertSource: (uid: string) => CapAlertSource`, `createCapAlertApi: (uid: string) => CapAlertApi`, created only in the authorized branch like the others), `web/src/main.tsx`
- Test: `web/src/home/capAlertApi.test.ts`, `web/src/home/useCapAlert.test.tsx`

**Interfaces:**
- Produces:
  - `type CapAlert = { month: string; lastLevel: number; total: number; cap: number }`
  - `visibleCapAlert(alert: CapAlert | null, dismissedLevel: number | null): CapAlert | null` — returns `alert` only when `dismissedLevel === null || alert.lastLevel > dismissedLevel`.
  - `interface CapAlertSource { subscribe(month: string, onData: (data: { alert: CapAlert | null; dismissedLevel: number | null }) => void, onError: (e: Error) => void): () => void }` — listens to `capAlerts/{month}` and `capAlerts/{month}/dismissals/{uid}` and emits once both have answered.
  - `interface CapAlertApi { dismiss(month: string, level: number): Promise<void> }` — `setDoc(capAlerts/{month}/dismissals/{uid}, { level })`.
  - `useCapAlert(source: CapAlertSource, month: string | null): { status: 'loading' | 'ready' | 'error'; alert: CapAlert | null }` (already filtered through `visibleCapAlert`; `month === null` → `ready`, `alert: null`).

- [ ] **Step 1: Write failing tests**: `visibleCapAlert` cases (no dismissal → shown; dismissed 50, last 50 → null; dismissed 50, last 75 → shown; null alert → null); `useCapAlert` with a fake source: emits alert → hook returns it; new emission with higher level after dismissal → returns the new one; month change resubscribes.
- [ ] **Step 2: Run** `npm --prefix web test -- capAlert`. Expected: FAIL.
- [ ] **Step 3: Implement** the files (follow `useCaps.ts`/`firestoreCaps.ts` patterns; Firestore code imports no `@/` modules, like the other `firestore*.ts` files).
- [ ] **Step 4: Run** `npm --prefix web test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): data layer for the cap alert`.

### Task 9: Home-screen alert UI

**Files:**
- Create: `web/src/home/CapAlertBanner.tsx`
- Modify: `web/src/home/HomeScreen.tsx`, `web/src/strings.ts` (`home.capAlert`), `web/src/App.tsx` (pass source/api into `HomeScreen`)
- Test: `web/src/home/CapAlertBanner.test.tsx`, `web/src/home/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `useCapAlert`, `CapAlertSource`, `CapAlertApi` (Task 8); `periods.current?.month` as the month.
- Produces: `CapAlertBanner({ alert, onDismiss }: { alert: CapAlert; onDismiss: () => void })` — `role="status"`, text `Superaste el {lastLevel}% de tu tope: vas gastando {formatMoney(total, 'ARS')}`, a "Entendido" button, visually distinct from the existing `AlertBanner`s (own colour, not part of the `alerts` list or its phone-collapsing summary). `HomeScreen` renders it above the existing alerts block; props `capAlertSource: CapAlertSource`, `capAlertApi: CapAlertApi`.

- [ ] **Step 1: Write failing tests**: banner shows the level and the formatted total and calls `onDismiss` on click; in `HomeScreen.test.tsx` (use its existing fakes) with a fake source emitting `{alert: {month, lastLevel: 50, total: 1000000, cap: 2000000}, dismissedLevel: null}` the banner appears, clicking "Entendido" calls `api.dismiss(month, 50)` and, when the fake source then emits `dismissedLevel: 50`, it disappears; with `dismissedLevel: 50` and `lastLevel: 75` it shows `75`; an alert for a month different from the current group's month is not shown; the existing alerts still render alongside it.
- [ ] **Step 2: Run** `npm --prefix web test -- CapAlertBanner HomeScreen`. Expected: FAIL.
- [ ] **Step 3: Implement** the component and integration; add the seed document to `scripts/seed-emulator.js` for the current month so the banner can be seen with `npm run dev:web`.
- [ ] **Step 4: Run** `npm --prefix web test`, `npm --prefix web run lint`, `npm --prefix web run build`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): cap threshold alert on the home screen`.

### Task 10: Web push registration and service worker

**Files:**
- Create: `web/public/firebase-messaging-sw.js`, `web/src/push/pushApi.ts`, `web/src/push/firebasePush.ts`, `web/src/push/usePushRegistration.ts`
- Modify: `web/src/lib/firebase.ts` (add `messagingSenderId` from `VITE_FIREBASE_MESSAGING_SENDER_ID`), `web/src/App.tsx` (call the hook in the authorized branch with a new prop `pushApi: PushApi`), `web/src/main.tsx`
- Test: `web/src/push/usePushRegistration.test.tsx`

**Interfaces:**
- Produces:
  - `interface PushApi { support(): 'supported' | 'unsupported'; permission(): 'default' | 'granted' | 'denied'; requestPermission(): Promise<'granted' | 'denied' | 'default'>; getToken(): Promise<string | null>; saveToken(uid: string, token: string): Promise<void> }` (`saveToken` upserts `pushTokens/{token}` with `{ uid, createdAt, updatedAt }`, keeping `createdAt` on update).
  - `usePushRegistration(api: PushApi, uid: string): void` — on mount: unsupported → nothing; `denied` → nothing; `default` → `requestPermission()`; if granted → `getToken()` → `saveToken(uid, token)`. Runs once per mount, errors are swallowed (console only). Disabled when `import.meta.env.VITE_USE_EMULATOR === 'true'` (done in `main.tsx` by passing an inert `PushApi`, not inside the hook).
  - Service worker `firebase-messaging-sw.js` (no Firebase imports): on `push`, read `event.data.json().data` (`title`, `body`, `url`) and `showNotification(title, { body, data: { url } , icon: '/icon.svg' })`; on `notificationclick`, close it and focus an existing client or `clients.openWindow('/')`. `firebasePush.ts` registers it explicitly and passes the registration to `getToken(messaging, { vapidKey: VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration })`.

- [ ] **Step 1: Write failing tests** with a fake `PushApi`: permission `default` → asks, then saves the token with the uid; already `granted` → no ask, saves; `denied` → neither; `unsupported` → nothing; token `null` → no save; `requestPermission` rejecting does not throw out of the hook.
- [ ] **Step 2: Run** `npm --prefix web test -- usePushRegistration`. Expected: FAIL.
- [ ] **Step 3: Implement** the files. If Chrome on Android does not show the permission prompt without a user gesture (check on the phone in Task 11), add the smallest in-app tap target that calls `requestPermission()` and keep everything else unchanged.
- [ ] **Step 4: Run** `npm --prefix web test`, `npm --prefix web run lint`, `npm --prefix web run build`. Expected: all pass; `web/dist/firebase-messaging-sw.js` exists.
- [ ] **Step 5: Commit** `feat(web): register FCM tokens and show push notifications`.

### Task 11: Deploy and verify on the phones (manual)

- [ ] **Step 1:** `terraform apply`, deploy the Function and `npm run web:deploy` (rules + hosting), following the updated `RUNBOOK.md`.
- [ ] **Step 2:** Follow the manual verification section added in Task 7 on both Android phones. Expected: push arrives, tap opens home, home alert appears on both and dismisses independently.
- [ ] **Step 3:** Record anything that differed (for example the permission prompt needing a tap) in `RUNBOOK.md` and fix it.

---

## Self-review

- **Spec coverage:** ladder, single-notification-for-highest-level, no re-arm, silent cap changes, latest TC, no backfill (nothing to build), FCM + tap → `/`, auto permission, in-app per-user alert with amount, parity with the web, failure isolation, infra and runbook — each maps to Tasks 1–10; the manual phone check is Task 11.
- **Types:** `levelFor`, `currentPeriodSpend`, `capFor`, `latestRate`, `raiseCapAlert`, `CapAlert`, `CapAlertSource`, `CapAlertApi`, `PushApi` have one definition each and the same names where consumed.
- **Not covered by automated tests:** real FCM delivery and the service worker (Task 11 manual).
