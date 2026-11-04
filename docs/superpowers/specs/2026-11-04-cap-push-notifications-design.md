# Spending-cap push notifications — design

## Intent

The household has a monthly spending cap ("tope de gasto", collection `spendingCaps`) and the home screen
shows how much of it the current period has used. Today you only learn you are near or over the cap by
opening the app. The goal is that **the phones are told as it happens**: when a purchase makes the current
period's spending reach a new threshold of the cap, both people get a push notification on their Android
phones.

Why now: purchases arrive by email all day; the useful moment to know "we just hit 75%" is the moment the
purchase lands, not whenever someone next opens the app.

## Goals

- When a new purchase is ingested, recompute the current period's spending against the cap and, if a
  threshold not yet announced for that period has been reached, send **one** push notification to every
  registered phone.
- Thresholds: 50%, 75%, 100%, then every further 10% above the cap (110%, 120%, 130%, ...).
- Notifications reach Android phones through Firebase Cloud Messaging (FCM web push from the installed
  PWA / Chrome). iOS is out of scope.
- Tapping the notification opens the app's home screen (`/`). Nothing else for now.

- **In-app alert on the home screen.** Whenever a threshold is announced (whether or not the push is tapped,
  seen, or even delivered), the home screen shows a dismissable alert, separate from the alerts that exist
  today, saying which threshold was passed and the amount spent at that point. Example: "Superaste el 50%
  de tu tope: vas gastando $1.000.000". Dismissal is **per user**: when one person dismisses it, the other
  still sees it the first time they open the app, and vice versa. Once a user dismisses it, it never
  comes back for that user (for that level).

## Non-goals

- iOS support.
- Deep links, action buttons, or any destination other than the home screen.
- A settings screen, per-user preferences, quiet hours, or a way to turn notifications off inside the app.
- Notifying for anything other than cap thresholds (new purchases, due dates, ...).
- Suppressing notifications during a backfill (`scripts/reprocess.js`). If a backfill makes several
  periods cross thresholds, the notifications arriving together is accepted.
- Notifying when a cap is edited. A cap change by itself never sends anything.

## Anti-goals (would make this a failure even if it technically works)

- The same threshold announced twice for the same period (Pub/Sub retries, reprocess, two purchases
  arriving close together).
- A notification failure (FCM down, no tokens, invalid token) making email ingestion fail or retry.
  A saved purchase must stay saved, and Pub/Sub must not redeliver because FCM failed.
- The backend and the web app disagreeing on what "spending of the current period" is.

## What the user sees

- Title/body in Spanish, e.g. title "Tope de gasto", body "Llegaste al 75% del tope" (100% and above use
  the same sentence with the threshold number: "Llegaste al 110% del tope"). Exact wording is the builder's
  call; the content the user asked for is the percentage reached.
- Tap → opens `/` (home).
- The app asks for notification permission by itself when it needs it (see "Registering phones").

## Behaviour (decided by the user)

1. **Threshold ladder.** 50, 75, 100, 110, 120, ... The level for a given percentage `p` is the highest
   ladder step `<= p`; below 50 there is no level.
2. **One notification per purchase batch, for the highest new level.** If one purchase jumps from 40% to 80%,
   send a single "75%" notification, not "50%" and "75%".
3. **Spending only goes up for alert purposes.** A period keeps its "last announced level". Expenses that
   lower the total never lower that level and never re-arm a threshold. A level is announced only when it
   is strictly higher than the last announced one for that period.
4. **Cap changes are silent.** Editing, adding or removing a cap sends nothing. On the next ingested
   purchase the percentage is recomputed with the cap then in force, and if it is at a level higher than
   the last announced one, that level is announced. (Consequence: raising the cap does not re-arm anything;
   lowering it can make the next purchase announce a level that was never announced.)
5. **Dollars.** USD charges are converted with the **latest exchange rate (TC) loaded** (the most recent
   month in the `rates` data with a rate > 0), not the period's own month rate. If no rate was ever
   loaded, USD counts as 0. Currencies other than ARS and USD are left out. (This intentionally differs
   from the web's `rateFor(rates, month)`; see "Parity with the web".)
6. **No backfill from now on.** Nothing is done retroactively when the feature is deployed. Consequence:
   the first purchase after deploy in a period that is already above some threshold announces the highest
   level reached, since nothing was announced yet for that period.

## What "current period spending" means

It must equal the number the home screen shows as the total of the **current** period group, plus the cap
for that group's month. The existing web code is the reference:

- `web/src/expenses/statements.ts` — `buildPeriods`, `tabIdFor`, `buildAccountViews`: statement periods per
  account from its closing dates (`cycles`); only purchases of stored **credit** cards of existing accounts
  (matched by last 4 digits + type) count; `status: 'rejected'` purchases are excluded; a purchase belongs to
  the period containing its Buenos Aires purchase day.
- `web/src/home/homePeriods.ts` — `buildHomePeriods` (the `current` group: for each account the period
  that contains today, or its "open" tab; summed across accounts), `makeGroup` (the group's `month` is the
  month of the latest closing date among its accounts; ARS + USD×rate), `capFor(month, caps)` (the month's own
  cap, else the latest earlier cap), `capLevel`.
- Percentage = group total (pesos) / cap amount × 100. No cap in force for the month → nothing to notify.
- "Today" is the Buenos Aires day (UTC-3, no DST); purchase dates are stored as midnight Buenos Aires time.

## How it gets built (my calls unless noted)

These are the design's decisions about the how; the user decided only the behaviour above and "FCM,
Android, permission asked by the app".

**Where the check runs.** In the backend, right after ingestion, inside the same Cloud Function
(`processNotification` in `src/sync.js`): after a batch of messages is processed and at least one new
expense was actually saved (`saveExpense` returned true), run the cap check **once** for the batch. Only
the backend creates expenses, so no Firestore trigger is needed. The check is wrapped so that any error is
logged (as an `ERROR` log, which already feeds the alert policy) and swallowed: ingestion still succeeds.

**Backend logic is a JS port of the web logic.** The backend is plain JS, the web is TS. The period/total/cap
computation is ported into `src/` with its own unit tests, plus parity tests that run the same fixtures
through the web functions and the backend port and compare totals and percentages. (Alternative rejected for
now: a shared package between web and Functions — more restructuring for a small amount of shared code.)
The backend reads `accounts`, `cards`, `cycles`, `rates`, `spendingCaps` and `expenses` from Firestore; the
collection and field names are those the web already uses (see `web/src/cards/firestoreCards.ts`,
`web/src/balance/firestoreRates.ts`, `web/src/home/firestoreCaps.ts`, `firestore.rules`).

**Announced-level state.** A Firestore document per period, e.g. `capAlerts/{YYYY-MM}` (keyed by the
group's `month`) holding `lastLevel` (a number: 50, 75, 100, 110, ...). Updated in a transaction that only
ever raises it. The level is raised **before** sending, so a retry cannot announce the same level twice;
the price is that a send that fails is not retried (acceptable; logged).

**In-app alert (home screen).**
- `capAlerts/{YYYY-MM}` also stores what the alert needs: `lastLevel`, `total` (the period's spending in
  pesos at the moment that level was announced, the amount shown to the user), `cap` and `announcedAt`. These
  are written in the same transaction that raises `lastLevel`, **independently of whether the push is sent
  or succeeds**, so the alert shows even with no registered phones or a failed FCM call.
- Per-user dismissal is stored in Firestore (not browser storage) so it survives reinstalling and works
  across a user's devices: for example `capAlerts/{YYYY-MM}/dismissals/{uid}` holding `{ level }`. Rules let
  a household member read/write only their own dismissal document. Which shape exactly is the builder's call.
- The home screen subscribes to the current period's `capAlerts` document and the signed-in user's
  dismissal. The alert is visible when `lastLevel` is greater than the user's dismissed level (or there is no
  dismissal). It stays visible, across opens, until that user dismisses it. Dismiss writes `{ level: lastLevel }`.
  If a higher level is announced later, the alert shows again for the new level (even if the old one was
  dismissed); if several levels were announced before the user opened the app, only the latest is shown.
- Only the alert of the current period's month is shown (the group's `month`, same as the cap card on home).
- It is a new, separate element from the existing alerts on the home screen; it does not replace or merge
  with them. It updates live if the app is open when the level is announced. Spanish wording, pesos formatted
  like the rest of the app (the app's existing money formatter).

**Registering phones.**
- Collection `pushTokens/{token}` with `{ uid, createdAt, updatedAt }`. Firestore rules let a signed-in
  household member (the existing `household` claim) create/update/delete their own token documents; the
  backend (Admin SDK) reads all of them.
- Web: add the Firebase Messaging SDK, a service worker (`firebase-messaging-sw.js`, served from the web
  root by Hosting) that shows the notification and, on click, focuses/opens `/`. New web config values
  (messaging sender id, VAPID public key) go through `web/.env.example` / `web/.env.emulator` like the
  existing Firebase config.
- When a signed-in household member opens the app and notification permission is `default`, the app asks
  for it by itself; if granted it fetches the FCM token and stores it (refreshing on token change). If
  denied, nothing more is done. If Chrome on Android refuses to show a permission prompt without a user
  gesture, the builder may add the smallest in-app tap target that triggers the prompt; this is the builder's
  call and should stay minimal (no settings screen).
- Backend sends with the Admin SDK `messaging().sendEachForMulticast` (data+notification payload with the
  click target `/`) and deletes tokens FCM reports as unregistered/invalid.

**Infrastructure (Terraform, `terraform/main.tf`).** Enable the FCM API; grant the Functions runtime service
account permission to send FCM messages; add `firebase-admin` to the Function dependencies; nothing else
changes in the pipeline (same function, same Pub/Sub push subscription). Update `RUNBOOK.md` for the new
config values and the API.

**Local development.** The emulator environment (`firebase.json`, `scripts/seed-emulator.js`) should keep
working; Firestore state for the feature (tokens, `capAlerts`) is testable in it. FCM delivery itself cannot
be emulated, so sending is behind an interface and unit-tested with a fake; a real end-to-end check on a
phone is a manual step in the runbook.

## Parity with the web

The one intentional difference is the exchange rate: the web converts a period's dollars with the TC of the
period's month (falling back to earlier, then latest); notifications use the latest loaded TC, as the user
specified. Everything else (which purchases count, periods, cap lookup, percentage) must match. The parity
tests must cover that difference explicitly (same data, rate loaded for an older month than the period's).

## Testing expectations

- Unit tests: ladder/level function (boundaries 49.99, 50, 74.99, 75, 99.99, 100, 109.99, 110, 125);
  jump over several levels sends one; no re-send of an announced level; lowering the total never re-arms;
  cap change alone sends nothing, next purchase announces a missed level; no cap → nothing; USD with and
  without a loaded rate; rejected purchases and debit cards excluded; multiple accounts with different
  closing dates; today's period selection across a closing date.
- The ingestion tests (`test/sync.test.js`, `test/index.test.js`) must show that an error in the cap check
  does not change the HTTP result of `processNotification`.
- Firestore rules tests (`test/rules.*.test.js` style) for `pushTokens` and `capAlerts`.
- Web: unit tests for the token-registration logic with a fake messaging layer.
- Web: the in-app alert shows for a level above the user's dismissed one; hides after dismiss; user A
  dismissing does not hide it for user B; reappears for a higher level; shows the stored `total`; ignores
  alerts of other months. Rules tests for the dismissal documents (own uid only).

## Left to the builder

Exact notification wording, file/module layout, the `capAlerts` document shape beyond `lastLevel`, token
refresh details, how to share fixtures between web and backend parity tests, and the in-app prompt fallback
described above.
