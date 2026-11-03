# Automatic card expense ingestion from Gmail — Design

Date: 2026-11-02

## Intent and rationale

The user receives an email from the bank (BBVA Argentina) every time they make a purchase with their Visa credit card ending in 1234. They want each purchase to be saved automatically to an online database, accessible from any device.

Underlying goal (out of scope here, but it drives decisions): to quickly see how much has been spent on the card so far this month and, later, to configure alerts when certain spending thresholds are reached. For that reason the data must be stored in a way that makes it easy to sum by date range.

## Scope

**Included:** a backend service that detects each new "Compra aprobada" ("Purchase approved") email, extracts the date, merchant and amount, and saves it to Firestore, without duplicates. All infrastructure defined with Terraform.

### Non-goals
- Display application (React). It will be built later, in a separate design.
- Threshold alerts and notifications. They will be built later.
- Other types of bank notices (refunds, rejections, other cards). Only "Compra aprobada".
- Expense categorization, installments or currency conversion.

### Anti-goals (would fail even if it "works")
- A purchase gets lost without anyone noticing (for example, because the Gmail `watch` expired).
- A purchase gets saved twice.
- Anything gets charged in Google Cloud for normal usage.
- The refresh token or credentials end up in the code, the repository or the Terraform state.

## Input: the email

Three email variants have been observed (all with sender `avisos-bbva-ar@bbva.com` and subject `Compra aprobada`): the standard approved purchase (credit or debit card, internal template tag `PagoAprobado_sinmillasTIT`), a purchase made with an additional card (`PagoAprobado_sinmillasADIC`, which adds "a nombre de SURNAME/NAME" to the sentence under the title), and a template that carries a hidden preheader "Rechazamos la compra con tarjeta por razones de seguridad" ("We rejected the purchase for security reasons"), has an amount of `ARS 0,00` and different icons (`aherir_nfc_tit`); the user confirmed that this one is a rejected purchase.

Parsing rules decided with the user: rejected purchases are saved with `status = 'rejected'` (detected by the text "Rechazamos la compra"); the card type comes from "tarjeta de crédito/débito" in the sentence under the title; the card holder is the first name in "a nombre de SURNAME/NAME X." when present (additional cards) and otherwise the first word of the sentence under the title (never hardcoded).

- Sender: `avisos-bbva-ar@bbva.com`. Subject: `Compra aprobada`. HTML body, always with the same format. Reference example: `test/fixtures/approved-purchase.html` (anonymized).
- Data to extract: date (`15/03/2026`, dd/mm/yyyy format), merchant (`RECARGAS EJEMPLO`), amount (`ARS 12.500,00`, with a dot as thousands separator and a comma as decimal separator), last 4 digits of the card (`1234`, appears in the text "tarjeta de crédito Visa terminada en 1234", i.e. "Visa credit card ending in 1234").
- The date in the body carries no time. The time the email was received (the `Date` header) is available and must be stored as well.
- The emails arrive in a personal Gmail mailbox belonging to the user.

## User decisions

- Language: JavaScript / Node.js.
- Platform: Google Cloud, using the free tier. The user agreed to attach a card to the billing account.
- Trigger: Gmail push notifications (`users.watch`) to Pub/Sub. Polling was ruled out.
- Processing: Cloud Run functions (Node.js).
- Database: Firestore. The user does not need SQL.
- Cloud Scheduler to renew the Gmail `watch` (it expires every 7 days).
- Infrastructure with Terraform, except for the manual steps listed below.
- Service only for "Compra aprobada".

## Architecture

```
Gmail --(users.watch)--> Pub/Sub topic --(push)--> Function "process-notification"
                                                       |-- Gmail API: history.list / messages.get
                                                       `-- Firestore: expenses collection

Cloud Scheduler (daily) --> Function "renew-watch" --> Gmail API users.watch
```

### Processing flow
1. Gmail publishes a message to the topic with `emailAddress` and `historyId` (it does not include the email content).
2. Pub/Sub delivers the message by push to the `process-notification` Function.
3. The Function uses the stored `historyId` (the last one processed, kept in Firestore) to ask Gmail for the new messages, filters those that match the sender and subject, fetches each full message, parses the HTML and saves the expense.
4. It updates the stored `historyId` and responds 2xx.

### Idempotency
- Each expense is saved using the Gmail message ID as the document ID. Reprocessing the same email does not create duplicates.

### Watch renewal
- Daily Cloud Scheduler job that invokes the `renew-watch` Function, which calls `users.watch` on the mailbox, restricted to the label or filter that corresponds to these emails if practical.
- In addition to renewing, this Function must also reconcile: review recent "Compra aprobada" emails and save any that are missing, to cover lost notifications.

## Data model (Firestore)

Expenses collection, one document per purchase, with ID = Gmail message ID. Minimum fields:
- purchase date (the one in the email body)
- date and time the email was received
- merchant
- amount (stored as a number, not as text) and currency (`ARS`)
- last 4 digits of the card
- card type: `credit` or `debit`
- card holder: first name only, as written by the bank (e.g. `JUAN`, `MARIA`)
- status: `approved` or `rejected`

It must be possible to query the sum of amounts by date range; the sum excludes rejected purchases (and treats documents without `status` as approved). A separate document stores the last processed `historyId`.

## Constraints

- Everything must fit within the Google Cloud and Gmail API free tiers for a volume of a few purchases per day.
- Firestore region: it cannot be changed after creation.
- If the OAuth app stays in "Testing" mode, the refresh token expires after 7 days: it must be moved to "In production".
- The Pub/Sub push endpoint must not be invocable by third parties (Pub/Sub push authentication, or equivalent).

## Infrastructure with Terraform

**Covers:** enabling APIs (Gmail, Pub/Sub, Cloud Run, Scheduler, Firestore, Secret Manager), topic and push subscription, Publisher permission for `gmail-api-push@system.gserviceaccount.com` on the topic, Functions, service accounts and IAM, Firestore database, Scheduler job, secret container in Secret Manager, and optionally a budget alert.

**Manual steps, done once:**
1. Create the billing account with a card (Terraform can only link it).
2. Configure the OAuth consent screen and move it to "In production".
3. Create the OAuth client ID.
4. A script that opens the browser, authorizes the Gmail account (read-only permission) and obtains the refresh token, loaded as the secret's value without passing through the code or the Terraform state.
5. Create in Gmail the label and the filter described above (before activating the `watch`).
6. Manually trigger the `watch` renewal Function for the first time.

## Decisions made by Claude (to be confirmed by the user when reading)

The user did not state these; they are reasonable assumptions so the builder does not have to guess.

- **Email sample:** The sample is `test/fixtures/approved-purchase.html` (anonymized HTML of a real email). It was verified: sender `avisos-bbva-ar@bbva.com`, subject `Compra aprobada`, data in three consecutive blocks (date, merchant, amount) with icons.
- **Google account (user decision):** the Google Cloud project, billing and mailbox all belong to the personal account `user@example.com`, with no organization.
- **Mailbox:** it is a personal `@gmail.com` account (the `Delivered-To` header of the example), not Workspace. OAuth scope: only `gmail.readonly`. Since it is a sensitive scope, the app in "In production" shows the unverified-app warning; for personal use this is accepted and verification is not requested.
- **Push protection:** the Functions are private (not public). The Pub/Sub push subscription and the Scheduler job authenticate with a service account through OIDC, and that account has the Cloud Run invoker role.
- **First start:** the initial `historyId` comes from the response of the first `users.watch`. No backfill of earlier emails is done (the system starts recording from the moment it is activated).
- **Reconciliation window:** the last 3 days, with the Gmail query `from:avisos-bbva-ar@bbva.com subject:"Compra aprobada" newer_than:3d`. If `history.list` returns 404 because the `historyId` is too old, the full reconciliation is run and the `historyId` is reset.
- **Notification filter (user decision):** the user manually creates in Gmail a filter (`from:avisos-bbva-ar@bbva.com subject:"Compra aprobada"`) that applies a dedicated label (named `Gastos BBVA`) without skipping the inbox. `users.watch` is called with `labelIds` = the ID of that label (obtained with `labels.list`; it is an internal ID like `Label_123`, not the name) and `labelFilterBehavior` INCLUDE. The Function still validates sender and subject before saving, for safety. The reconciliation query can use `label:Gastos-BBVA` (Gmail search writes spaces in label names as hyphens). The label name is configured, not hardcoded in the code.
- **Monitoring of silent failures:** a Cloud Monitoring alert by email to the user when any Function fails (including an invalid or revoked OAuth token). The budget alert stops being optional and becomes part of the design.
- **Dates:** the purchase date is stored as a Firestore Timestamp interpreted in the `America/Argentina/Buenos_Aires` time zone. Purchases from other cards are also stored if they arrive, with their last 4 digits; no filtering by card.

## Out of scope for this document / the builder's responsibility

- Repository structure, libraries, folder structure and test tooling.
- HTML parsing strategy (for example, selectors that are robust against small format changes) and handling of emails that do not match the expected format (log and do not break).
- Where to keep the Terraform state (local or in a bucket).
- Specific Firestore and Functions region, choosing one close to Argentina within the free tier.
- Details of retries and error handling in Pub/Sub, avoiding infinite retry loops.
- Tests, including parsing tests based on the anonymized sample emails in `test/fixtures/`.
