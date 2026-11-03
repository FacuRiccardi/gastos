# Deployment runbook — card expense ingestion

Required tools: Node.js, Terraform ≥ 1.5, Google Cloud CLI (`gcloud`), all with the account your personal Google account.

On Windows, in PowerShell (then close and reopen the terminal so the PATH is refreshed):
```
winget install Hashicorp.Terraform
winget install Google.CloudSDK
terraform -version     # expect v1.5 or later
gcloud --version
```

## One-time steps, in order

1. **Billing account.** At https://console.cloud.google.com/billing create the account with your card. Note the ID (`XXXXXX-XXXXXX-XXXXXX`).
2. **Project.** Create a new project (no organization) and link it to the billing account.
   - **Console:** at https://console.cloud.google.com/projectcreate create the project (pick a project ID, e.g. `my-expenses-project`; it cannot be changed later). Then open https://console.cloud.google.com/billing/linkedaccount?project=<ID>, click **Link a billing account**, choose the account from step 1 and confirm. The project's *Billing* page should then show that account.
   - **CLI (alternative):**
     ```
     gcloud auth login
     gcloud auth application-default login
     gcloud projects create <ID>
     gcloud config set project <ID>
     gcloud billing accounts list                      # copy the ACCOUNT_ID
     gcloud billing projects link <ID> --billing-account=<ACCOUNT_ID>
     ```
   - Either way, still run `gcloud auth login`, `gcloud auth application-default login` and `gcloud config set project <ID>` (Terraform and `scripts/authorize.js` use them), and check the link with `gcloud billing projects describe <ID>` (expect `billingEnabled: true`).
3. **Google Auth Platform (OAuth consent screen).** The consent screen is now configured in *Google Auth Platform* (https://console.cloud.google.com/auth/overview, same as *APIs & Services → OAuth consent screen*). First enable the Gmail API so its scope can be selected: `gcloud services enable gmail.googleapis.com`.
   1. Click **Get started** and fill in: *App information* (app name, e.g. `card-expenses`, and your support email), *Audience* = **External**, *Contact information* (your email), and accept the policy.
   2. *Data Access → Add or remove scopes*: add `https://www.googleapis.com/auth/gmail.readonly` and save.
   3. *Branding*: besides the app name and support email, **Publish app** requires a **home page URL** and a **privacy policy URL**. They can be two very simple public pages (e.g. GitHub Pages or Google Sites): the policy only needs to say that the app reads purchase-notification emails from your own mailbox, stores date/merchant/amount in your private database and shares nothing. Google does not verify them unless you request formal verification, which this app does not need. (*Internal* is not available: it only exists for Google Workspace organizations.)
   4. *Audience → Publishing status → **Publish app*** (confirm). The status must read **In production**. If it stays in *Testing*, the refresh token expires after 7 days.
   When authorizing in step 7 you will see the "Google hasn't verified this app" warning: this is expected for personal use (choose *Advanced → Go to card-expenses*).
4. **OAuth client ID.** In *Google Auth Platform → Clients → Create client* (or *APIs & Services → Credentials → Create credentials → OAuth client ID*), type **Desktop app**. Save the client ID and the client secret.
5. **Terraform, first pass** (creates APIs, topic, Firestore, empty secret, service accounts, alerts and budget; it does **not** deploy the Functions yet):
   ```
   cd terraform
   cp terraform.tfvars.example terraform.tfvars   # fill in project_id, gmail_user, alert_email, billing_account_id
   terraform init
   terraform apply
   ```
   Firestore is created in `us-central1` and **that location cannot be changed**. If you want another one, adjust `firestore_location` before this step.
6. **Label and filter in Gmail.** In Gmail: search for `from:avisos-bbva-ar@bbva.com subject:"Compra aprobada"` (the bank's email subject, "Purchase approved") → *Create filter* → *Apply the label* `Gastos BBVA` (create it). Checking "Skip the Inbox" (archive) is optional: the service watches the label, not the Inbox, so archived emails are still processed.
7. **Authorize and load the secret.**
   From the project root (not from `terraform/`), in PowerShell:
   ```powershell
   $env:GOOGLE_CLIENT_ID = '<client-id>.apps.googleusercontent.com'
   $env:GOOGLE_CLIENT_SECRET = 'GOCSPX-<client-secret>'
   $env:GCP_PROJECT_ID = '<project-id>'
   node scripts/authorize.js
   ```
   (In bash/Git Bash the equivalent is `GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GCP_PROJECT_ID=<ID> node scripts/authorize.js`.) The variables only live in that terminal window.
   The browser opens; accept the read-only permission. The script stores `{clientId, clientSecret, refreshToken}` as a new version of the `gmail-oauth` secret without printing or writing the token. Check: `gcloud secrets versions list gmail-oauth`.
   **Get the label's internal ID** (the real ID Gmail assigned, like `Label_8472913650123456789`; not the name). Still in the same PowerShell window, from the project root:
   ```powershell
   node scripts/get-label-id.js
   ```
   (Optional argument if the label has another name: `node scripts/get-label-id.js "Other name"`.) It prints the ID and the exact line to paste into `terraform.tfvars`.
8. **Terraform, second pass** (deploys Functions, push subscription and Scheduler). In `terraform.tfvars` add `deploy_functions = true` and `gmail_label_id = "<the id printed in step 7>"`, and run `terraform apply`.
9. **Activate the watch** (only once; afterwards Scheduler renews it daily):
   ```
   gcloud scheduler jobs run renew-watch-daily --location=us-central1
   ```

## End-to-end verification

1. Wait for a real purchase (or forward yourself a "Compra aprobada" email that matches the filter). In the Firestore console a new document must appear in `expenses` with `merchant`, `amount`, `currency`, `cardLast4`, `purchaseDate` and `receivedAt` within a few seconds.
2. **Idempotency:** in Pub/Sub, publish again to the `gmail-notifications` topic a message `{"emailAddress":"user@example.com","historyId":"<a number greater than the one stored in state/sync>"}`. There must still be only one document per email.
3. **Alerts:** to test the failure email, invoke `process-notification` with an invalid body (this generates an `ERROR` log) and confirm that the Cloud Monitoring email arrives.
4. **Renewal:** in Cloud Scheduler, run the job and check in the `renew-watch` logs that it finished without errors.

## Loading older emails (backfill)

The service only loads new emails and, once a day, the last 3 days. To load older ones:
1. Make sure those emails have the Gmail label (search `from:avisos-bbva-ar@bbva.com subject:"Compra aprobada"`, select all, including "Select all conversations", and apply the label). Applying the label also triggers push notifications, so deploy the latest code first.
2. From the project root, in PowerShell (use a number of days that covers the oldest email):
   ```powershell
   $env:GCP_PROJECT_ID = '<project-id>'
   $env:GMAIL_USER = '<your-gmail-address>'
   node scripts/reprocess.js --days 35
   ```
   Existing expenses are never overwritten. If the data model changes, delete the documents in the `expenses` collection first.

## Local tests

- `npm test` — parser, decoding, sync and handlers (nothing else required).
- `npm run test:store` — data layer against the Firestore emulator (requires Java).

## If something fails

- No new purchases in Firestore but no alerts: check that the `watch` is active (run the Scheduler job) and that the `Gastos BBVA` label is being applied to the emails.
- `invalid_grant` in the logs: the refresh token was revoked or expired; repeat step 7 and check that the app is "In production".
- Pub/Sub stops retrying after 24 h; the daily reconciliation recovers the last 3 days.
