# Card expense ingestion from Gmail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save to Firestore every BBVA "Compra aprobada" ("Purchase approved") email that arrives at `user@example.com`, without duplicates and without missing any.

**Architecture:** Gmail `users.watch` (filtered by a dedicated label) publishes to Pub/Sub; a push subscription authenticated with OIDC invokes the `process-notification` Function, which reads the new emails with the Gmail API, parses them and saves them to Firestore using the email ID as the document ID. Cloud Scheduler invokes the `renew-watch` Function every day, which renews the `watch` and reconciles the last 3 days. Everything defined with Terraform.

**Tech Stack:** Node.js 22 (ESM), Vitest, `googleapis`, `@google-cloud/firestore`, `@google-cloud/functions-framework`, `cheerio` (HTML parsing), Terraform (`google` provider), Firestore emulator for data layer tests.

**Spec:** `design/spec.md`

## Global Constraints

- Language: JavaScript / Node.js. No TypeScript.
- Platform: Google Cloud on the free tier; Firestore database (no SQL); billing goes on the personal account `user@example.com`, with no organization.
- Only emails from `avisos-bbva-ar@bbva.com` with subject `Compra aprobada` (Spanish for "Purchase approved") are processed.
- OAuth scope: only `https://www.googleapis.com/auth/gmail.readonly`.
- Each expense is a document with ID = Gmail message ID (idempotency).
- Amount stored as a number, currency `ARS`; purchase date interpreted in `America/Argentina/Buenos_Aires` (UTC-3, no daylight saving time); the email's reception date/time (`Date` header) is also stored.
- The Functions are private; Pub/Sub and Scheduler authenticate by OIDC with a service account.
- The refresh token and OAuth credentials never go into the code, the repository or the Terraform state.
- Any last-4-digits of the card is stored (no filtering by card).
- Email alerts (Cloud Monitoring) on Function failures, and a budget alert: part of the design, not optional.
- Reference sample: `test/fixtures/approved-purchase.html` (anonymized HTML of a real email).

## Names decided by this plan

Collection `expenses`; state document `state/sync` with field `historyId` (string). Fields of an expense: `purchaseDate` (Timestamp), `receivedAt` (Timestamp), `merchant` (string), `amount` (number), `currency` (string), `cardLast4` (string). Function environment variables: `GMAIL_USER`, `GMAIL_LABEL_ID`, `GMAIL_OAUTH_SECRET` (JSON `{clientId, clientSecret, refreshToken}` mounted from Secret Manager).

## Review Focus

Inputs or failures that the spec implies but no obvious task covers; each has its test in the indicated task.

1. Email with the label but a different sender or subject → ignored, not saved (Task 4).
2. Amounts with and without thousands separator (`ARS 12.500,00`, `ARS 950,00`, `ARS 1.234.567,89`) and a currency other than ARS (`USD 25,50`) (Task 1).
3. Merchant with HTML entities or accents (`CAF&Eacute; &amp; CIA`) → decoded (Task 1).
4. Email missing the expected fields (BBVA changes the format) → logged with severity ERROR (triggers the alert), responds 2xx and is not retried forever; whereas a transient Gmail/Firestore failure responds 5xx (Task 4 and 5).
5. Repeated notification or one with a `historyId` older than the stored one → does not duplicate nor move the state backwards; `history.list` with 404 → falls back to full reconciliation (Task 4).

---

### Task 1: Email parser

**Files:**
- Create: `package.json`, `.gitignore`, `vitest.config.js`, `src/parser.js`, `test/fixtures/approved-purchase.html` (decoded HTML extracted from the `.eml`), `test/parser.test.js`
- Fixture: the sample email HTML, anonymized, as `test/fixtures/approved-purchase.html` (see below)

**Interfaces:**
- Produces: `parsePurchaseApproved(html: string) -> { purchaseDate: string /* 'YYYY-MM-DD' */, merchant: string, amount: number, currency: string, cardLast4: string }`. Throws `ParseError` (exported, `extends Error`) if any field is missing.

- [ ] **Step 1:** `git init`; create `package.json` (`"name": "card-expenses"`, `"type": "module"`, `"engines": {"node": ">=22"}`, scripts `test` = `vitest run`), `.gitignore` (`node_modules`, `.env`, `*.tfstate*`, `.terraform`, `terraform.tfvars`) and install `vitest` and `cheerio`. Extract the HTML from the sample `.eml` (decode quoted-printable) into the fixture.
- [ ] **Step 2: Tests** in `test/parser.test.js`:
  - `parses the sample email`: result `{ purchaseDate: '2026-03-15', merchant: 'RECARGAS EJEMPLO', amount: 12500, currency: 'ARS', cardLast4: '1234' }`.
  - `parses amounts`: `ARS 950,00` → `950`; `ARS 1.234.567,89` → `1234567.89`; `USD 25,50` → currency `USD`, amount `25.5` (the HTML is built by varying the fixture).
  - `decodes HTML entities in the merchant`: `CAF&Eacute; &amp; CIA` → `CAFÉ & CIA`.
  - `throws ParseError if the amount is missing` and `throws ParseError if the HTML is not a purchase`.
- [ ] **Step 3:** Run `npx vitest run test/parser.test.js`; expected: FAIL (module does not exist).
- [ ] **Step 4:** Implement `parsePurchaseApproved` in `src/parser.js`. Approach: in the HTML, the date, the merchant and the amount are the three consecutive `<p>` elements with an icon (`calendar_b.png`, `Shop.png`, `Receipt.png`); locate each one by the image in its row and not by absolute position. The last 4 digits come from the text `terminada en (\d{4})` (Spanish for "ending in"). The amount is normalized by removing thousands dots and replacing the decimal comma.
- [ ] **Step 5:** Run the suite; expected: PASS.
- [ ] **Step 6:** `git add -A && git commit -m "feat: Compra aprobada email parser"`.

### Task 2: Gmail message decoding

**Files:**
- Create: `src/message.js`, `test/message.test.js`, `test/fixtures/gmail-message.json` (`users.messages.get` object in `full` format built from the `.eml`: `payload.headers`, nested parts with `body.data` in base64url)

**Interfaces:**
- Produces: `extractMessage(message: GmailMessage) -> { id: string, sender: string /* address only */, subject: string, receivedAt: Date, html: string }`. Throws `ParseError` (imported from `src/parser.js`) if there is no `text/html` part.

- [ ] **Step 1: Tests**: `extracts sender, subject and date` (sender `avisos-bbva-ar@bbva.com`, subject `Compra aprobada`, `receivedAt` = `2026-03-15T18:30:00.000Z` from the `Date` header); `finds the HTML in nested multipart parts and decodes base64url`; `throws ParseError if there is no text/html`.
- [ ] **Step 2:** Run the test; expected: FAIL.
- [ ] **Step 3:** Implement `extractMessage` in `src/message.js`, walking `payload.parts` recursively; the sender is extracted from the `From` header (it may come as `Name <address>`).
- [ ] **Step 4:** Run the suite; expected: PASS.
- [ ] **Step 5:** Commit `feat: Gmail message decoding`.

### Task 3: Data layer (Firestore)

**Files:**
- Create: `src/store.js`, `test/store.test.js`
- Modify: `package.json` (dep `@google-cloud/firestore`; script `test:store` = `firebase emulators:exec --only firestore "vitest run test/store.test.js"`, dev-dep `firebase-tools`; requires Java installed)

**Interfaces:**
- Produces:
  - `createStore(db: Firestore) -> Store`
  - `store.saveExpense(id: string, expense: Expense) -> Promise<boolean>` — `true` if it created it, `false` if it already existed (uses `create()`, never overwrites). `Expense = { purchaseDate: string 'YYYY-MM-DD', receivedAt: Date, merchant, amount, currency, cardLast4 }`; the store converts `purchaseDate` to the Timestamp `YYYY-MM-DDT00:00:00-03:00`.
  - `store.getHistoryId() -> Promise<string | null>`, `store.setHistoryId(id: string) -> Promise<void>` (only moves forward: ignores an id lower than the stored one, numeric comparison).
  - `store.sumByRange(from: Date, to: Date) -> Promise<number>` (`sum` aggregation over `amount` with `purchaseDate` in `[from, to)`).

- [ ] **Step 1: Tests** against the emulator: `saveExpense returns true the first time and false the second without modifying the document`; `stores purchaseDate as a Timestamp of 00:00 in Buenos Aires` (15/03/2026 → `2026-03-15T03:00:00Z`); `getHistoryId returns null if there is no state`; `setHistoryId does not go backwards` (store `200`, then `150` → stays `200`; compare `"1000"` with `"999"` numerically); `sumByRange sums only expenses within the range` (3 expenses, 2 in range).
- [ ] **Step 2:** `npm run test:store`; expected: FAIL.
- [ ] **Step 3:** Implement `src/store.js` with the collection/field names from the "Names decided by this plan" section.
- [ ] **Step 4:** `npm run test:store`; expected: PASS.
- [ ] **Step 5:** Commit `feat: Firestore data layer`.

### Task 4: Sync logic

**Files:**
- Create: `src/sync.js`, `test/sync.test.js`

**Interfaces:**
- Consumes: `extractMessage` (Task 2), `parsePurchaseApproved`/`ParseError` (Task 1), `Store` (Task 3), and an injected Gmail client with this shape (implemented by Task 5):
  `GmailClient = { listHistory(startHistoryId: string): Promise<{ messageIds: string[], historyId: string }>` (throws `HistoryExpiredError`, exported from `src/sync.js`, if Gmail responds 404), `listMessages(query: string): Promise<string[]>`, `getMessage(id: string): Promise<GmailMessage>`, `startWatch(): Promise<{ historyId: string }> }`.
- Produces:
  - `processNotification({gmail, store, config, logger}, { emailAddress: string, historyId: string }) -> Promise<{ saved: number }>`
  - `reconcile({gmail, store, config, logger}) -> Promise<{ saved: number }>` — uses the query `label:<config.labelName> newer_than:3d` plus sender/subject validation.
  - `renewWatch(deps) -> Promise<void>` — calls `gmail.startWatch()`, stores the returned `historyId` only if there was none, and runs `reconcile`.
  - `config = { user: string, labelName: string }`.

- [ ] **Step 1: Tests** with in-memory fake `gmail` and `store`:
  - `saves a new purchase` (1 valid message → `saved: 1`, store has the expense under the message ID).
  - `ignores a different sender or subject` (message from another sender with the label's structure → `saved: 0`).
  - `does not duplicate when reprocessing the same notification` (two calls → a single effective write; `saved` 1 and 0).
  - `ignores notifications for a different emailAddress`.
  - `an email without the expected fields logs ERROR, does not save and does not throw` (verify `logger.error` was called; the rest of the messages in the batch are processed anyway).
  - `a Gmail failure other than 404 propagates` (the HTTP layer will respond 5xx).
  - `expired history (HistoryExpiredError) falls back to reconcile and resets the historyId`.
  - `does not move the historyId backwards` with an old notification.
  - `reconcile saves missing emails and does not duplicate existing ones`.
  - `renewWatch stores the initial historyId only if it did not exist`.
- [ ] **Step 2:** `npx vitest run test/sync.test.js`; expected: FAIL.
- [ ] **Step 3:** Implement `src/sync.js`. The sender and subject validation lives in an internal function `isApprovedPurchase(message)`. The `logger` exposes `info` and `error` and errors carry `severity: 'ERROR'` (Cloud Logging structured JSON format).
- [ ] **Step 4:** Run the suite; expected: PASS.
- [ ] **Step 5:** Commit `feat: sync and reconciliation logic`.

### Task 5: Gmail client and Functions HTTP entry points

**Files:**
- Create: `src/gmailClient.js`, `src/index.js`, `test/index.test.js`
- Modify: `package.json` (deps `googleapis`, `@google-cloud/functions-framework`; `"main": "src/index.js"`)

**Interfaces:**
- Consumes: `GmailClient`, `processNotification`, `renewWatch` (Task 4); `createStore` (Task 3).
- Produces:
  - `createGmailClient({ clientId, clientSecret, refreshToken, user, labelId }) -> GmailClient` (wraps `googleapis`; `startWatch` calls `users.watch` with `topicName` from `PUBSUB_TOPIC`, `labelIds: [labelId]`, `labelFilterBehavior: 'INCLUDE'`; translates a 404 from `history.list` into `HistoryExpiredError`).
  - HTTP Functions registered with `functions.http`: `processNotification` and `renewWatch` (entry point names in `src/index.js`), deployed as the Cloud Functions `process-notification` and `renew-watch`.
  - `createProcessHandler(deps) -> (req, res) => Promise<void>` (exported for tests): decodes `req.body.message.data` (base64 → JSON `{emailAddress, historyId}`); responds 204 if everything went well or if there was a permanent error (`ParseError`, invalid body, logged as ERROR); responds 500 on transient errors.
  - `createRenewHandler(deps)` for `renewWatch`; dependencies are built through `withDeps`.

- [ ] **Step 1: Tests** of `createProcessHandler` with fake `deps`: `responds 204 with a valid notification`; `responds 204 and logs ERROR with an invalid body`; `responds 500 if processNotification throws a transient error`.
- [ ] **Step 2:** Run the test; expected: FAIL.
- [ ] **Step 3:** Implement `src/gmailClient.js` and `src/index.js`. `index.js` reads `GMAIL_OAUTH_SECRET`, `GMAIL_USER`, `GMAIL_LABEL_ID`, `PUBSUB_TOPIC`, `GMAIL_LABEL_NAME`, and builds the dependencies once per instance (`withDeps`). `createGmailClient` is not unit tested (thin wrapper); it is validated in the end-to-end verification.
- [ ] **Step 4:** Run the full suite (`npm test`); expected: PASS.
- [ ] **Step 5:** Commit `feat: Gmail client and HTTP entry points`.

### Task 6: OAuth authorization script

**Files:**
- Create: `scripts/authorize.js`, `RUNBOOK.md` (completed in Task 8)

**Interfaces:**
- Consumes: variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GCP_PROJECT_ID` (from the environment).
- Produces: a new version of the `gmail-oauth` secret in Secret Manager with the JSON `{clientId, clientSecret, refreshToken}`.

- [ ] **Step 1:** Implement `scripts/authorize.js`: starts a local server on a free port for the redirect, opens the browser with scope `gmail.readonly`, `access_type=offline` and `prompt=consent`, exchanges the code for tokens and runs `gcloud secrets versions add gmail-oauth --data-file=-` passing the JSON through stdin. It does not print or write the token to disk or to the console.
- [ ] **Step 2:** Manual verification: run with the real credentials (after Task 7 has created the secret) and confirm with `gcloud secrets versions list gmail-oauth` that there is a new version. Expected: enabled version, and the token does not appear in the script's output.
- [ ] **Step 3:** Commit `feat: OAuth authorization script`.

### Task 7: Infrastructure with Terraform

**Files:**
- Create: `terraform/main.tf`, `terraform/variables.tf`, `terraform/outputs.tf`, `terraform/terraform.tfvars.example`

**Interfaces:**
- Variables: `project_id`, `region` (choose one close to Argentina within the free tier, e.g. `southamerica-east1` if available for the usage; otherwise `us-central1`), `gmail_label_id`, `gmail_label_name`, `gmail_user` (`user@example.com`), `alert_email`, `billing_account_id`, `monthly_budget_usd`.
- Resources: enabled APIs (Gmail, Pub/Sub, Cloud Run, Cloud Functions, Cloud Build, Artifact Registry, Cloud Scheduler, Firestore, Secret Manager, Cloud Monitoring, Billing Budgets); topic `gmail-notifications` with `roles/pubsub.publisher` for `serviceAccount:gmail-api-push@system.gserviceaccount.com`; Firestore in native mode; secret `gmail-oauth` (container only); service accounts `expenses-functions` (access to Firestore and the secret) and `expenses-invoker` (invoker role on both Functions); the two private 2nd-gen Functions `process-notification` and `renew-watch`; push subscription `gmail-notifications-push` with `oidc_token` pointing at `process-notification`, `message_retention_duration = "86400s"` and a retry policy with backoff; daily Scheduler job `renew-watch-daily` targeting `renew-watch` with OIDC; email notification channel and an alert policy on logs with `severity>=ERROR` from both Functions; budget alert.
- Terraform state: local (decision of this plan; it is in `.gitignore`).

- [ ] **Step 1:** Write the Terraform files.
- [ ] **Step 2:** `terraform -chdir=terraform init && terraform -chdir=terraform validate`; expected: `Success! The configuration is valid.`
- [ ] **Step 3:** `terraform -chdir=terraform plan` with a real `terraform.tfvars`; expected: plan without errors that creates the listed resources and contains no secret value.
- [ ] **Step 4:** Commit `feat: Terraform infrastructure`.

### Task 8: Runbook and end-to-end verification

**Files:**
- Modify: `RUNBOOK.md`

- [ ] **Step 1:** Document, in this order, the manual steps from the spec: (1) billing account; (2) create the project and the OAuth consent screen → "In production"; (3) create OAuth client ID; (4) `terraform apply` (first pass, with `gmail_label_id` empty if it does not exist yet); (5) create in Gmail the label `Gastos BBVA` and the filter `from:avisos-bbva-ar@bbva.com subject:"Compra aprobada"` without skipping the inbox, and get its ID with `labels.list`; (6) `node scripts/authorize.js`; (7) second `terraform apply` with `gmail_label_id`; (8) trigger `renewWatch` once (`gcloud scheduler jobs run`).
- [ ] **Step 2:** Verification: forward yourself or wait for a real "Compra aprobada" email and check in the Firestore console that the document appears in `expenses` with the expected fields within a few seconds. Expected: 1 new document; if the notification is sent again (republish the Pub/Sub message from the console), there is still 1 document.
- [ ] **Step 3:** Alert verification: cause an error (e.g. a secret with an invalid token in a test instance) and confirm that the Cloud Monitoring email arrives.
- [ ] **Step 4:** Commit `docs: deployment runbook`.

---

## Self-review (done)

- **Spec coverage:** parsing (T1), decoding (T2), Firestore and idempotency (T3), reconciliation, first start with the `historyId` from `watch`, history 404, sender/subject validation (T4), push + OIDC + permanent/transient error handling (T5, T7), OAuth without secrets in code (T6), Terraform and manual steps (T7, T8), alerts and budget (T7), filter and label (T7, T8).
- **Type consistency:** `GmailClient`, `Store`, `ParseError`, `HistoryExpiredError` and the signatures of `processNotification` / `renewWatch` are the same in the tasks that consume them.
- **Proportion:** the plan decides names, interfaces and values from the spec; function bodies are left to the implementer.
