# Web app: expense tables and authentication — Design

Date: 2026-11-04

## Intent and why

The ingestion service (see `design/spec.md`) already stores every card purchase in Firestore (`expenses` collection). This feature is the first version of the app to **look at that data** from a phone or a computer, used only by two people (the owner and their partner).

Goal of this first version: open the app, sign in with Google and see the stored purchases grouped by **person + card**, so it is quick to check what a given person bought with a given card. Authentication must make sure nobody else can see the data.

The repository is **public** (it is part of the owner's portfolio), so nothing personal can live in it.

## Scope

**Included:** the React app (read-only), Google sign-in, Firestore security rules that restrict reads to the two authorized people, a script to authorize/revoke people, hosting on Firebase Hosting, tests, and the deployment steps in the runbook.

### Non-goals (later)
- Categories for expenses, filters, month selector, charts, totals dashboards, alerts/notifications.
- Any write from the app. The app never creates, edits or deletes data.
- Offline mode / PWA, multiple languages.

### Anti-goals (a failure even if it "works")
- Anyone other than the two authorized people can read any document (a signed-in stranger included).
- Any write is possible from a browser.
- Personal data in the repository: emails, project/billing IDs, the Firebase web config, real purchases.
- The UI is the only protection (the data must be protected by the Firestore rules, not by hiding things in the app).

## What the app shows

- **One section per person + card**, i.e. per unique pair (`cardHolder`, `cardLast4`). Sections are shadcn **Accordion** items with the `multiple` prop (several can be open at once). They start **collapsed** (my guess, easy to change).
- **Section header:** person, card type (`credit` / `debit`) with the last 4 digits, number of purchases and the total of **approved** purchases.
- **Section content:** a shadcn **Table** with columns Date, Merchant, Amount, ordered by purchase date, newest first. Rejected purchases (`status = "rejected"`) are shown too, with a "Rejected" **Badge**, and are not counted in the total (my guess).
- Section order: by holder name, then by last 4 digits.
- Formats: amounts as Argentine pesos (`$ 12.500,00`, `Intl.NumberFormat("es-AR")`); dates displayed in the `America/Argentina/Buenos_Aires` time zone (a stored `purchaseDate` is midnight Buenos Aires time).
- Empty state: a message when there are no expenses.
- UI texts are in Spanish (Argentine), kept in one place so they are easy to change (my call).

## Authentication and authorization

Four states, decided with `onAuthStateChanged` (the initial "unknown" state shows a loading indicator, not the login screen):
1. **Loading.**
2. **Signed out:** login screen with a "Sign in with Google" button (popup flow, Firebase Authentication).
3. **Signed in but not authorized:** a "no access" screen with a sign-out button and a "check again" button that force-refreshes the ID token (`getIdToken(true)`) and re-reads the claim, because a freshly granted claim only appears in a refreshed token.
4. **Authorized:** the app (header with the user's name/avatar and a sign-out button, plus the tables).

The client reads the claim with `getIdTokenResult()` **only to choose which screen to show**. Real enforcement is in Firestore.

### Firestore security rules (`firestore.rules`)
- `expenses` documents: **read** allowed only if `request.auth != null`, `request.auth.token.email_verified == true` and `request.auth.token.household == true`.
- Everything else is denied: every write, and reads of any other collection (including `state/sync`).
- The Cloud Functions write with the Admin SDK, which bypasses the rules, so the ingestion service is not affected.
- The custom claim is named `household`. The shape of reading a custom claim inside Firestore rules (`request.auth.token.<claim>`) is not confirmed by the official pages reviewed; **it must be proven with emulator tests**, not assumed.
- Rules tests with `@firebase/rules-unit-testing` and the Firestore emulator (Java is already available). Cases: not signed in → denied; signed in without the claim → denied; with the claim but unverified email → denied; with the claim and verified email → allowed to read `expenses`; no one can create/update/delete; no one can read `state/sync`.

### Authorizing people: `scripts/grant-access.js`
- Node script using the Firebase Admin SDK with the owner's gcloud application default credentials.
- `node scripts/grant-access.js <email>` sets the `household` claim; `node scripts/grant-access.js --revoke <email>` removes it. The user must have signed in once so that the account exists (`getUserByEmail`).
- `setCustomUserClaims` **replaces all existing claims**, so the script must read the current claims first and merge.
- Emails are passed as arguments: they are never stored in the repository.
- A claim only reaches an ID token when it is refreshed (up to one hour, or on a forced refresh or new sign-in). After revoking, the script should also revoke the user's refresh tokens so the effect is not delayed (the builder verifies this in the Admin SDK documentation).

## Hosting and configuration

- The app lives in `web/` in this repository. Build output is served by **Firebase Hosting** as a single-page app (all paths rewrite to `index.html`), deployed with the Firebase CLI. Default URLs: `<project-id>.web.app` and `<project-id>.firebaseapp.com`.
- Firebase web configuration comes from `VITE_FIREBASE_*` variables in `web/.env`, which is git-ignored, with a committed `web/.env.example` with placeholders. The project ID must not be committed (including `.firebaserc`, which is git-ignored or replaced by passing `--project`).
- Manual one-time steps go to `RUNBOOK.md`: add Firebase to the existing Google Cloud project, enable the Google sign-in provider in Firebase Authentication, register the web app and copy its config into `.env`, deploy the rules and the site, sign in once with each account and run `grant-access`.
- `firebase.json` (which already configures emulators) is extended with the `hosting` and `firestore` (rules) entries.

## Technology (decisions)

- Vite + React + **TypeScript** (shadcn's installation guide assumes TypeScript), Tailwind CSS v4 (`@tailwindcss/vite`), the `firebase` npm package (modular SDK), Vitest.
- **shadcn/ui** installed by following the official documentation at the time of the work (https://ui.shadcn.com/docs/installation/vite), not from memory: the CLI and the components changed recently (for example, Accordion uses `multiple`, and the component base can be Base UI, Radix or React Aria). Components needed: accordion, table, badge, button, card. Use the library base that the official docs/CLI present as the default unless the CLI prompts otherwise.

## Tests

- Pure function that groups and sorts expenses and computes the totals (Vitest, no UI): grouping by holder + card, ordering, totals excluding rejected, empty input.
- Component tests (Testing Library) for the four authentication states and for expanding/collapsing a section.
- Firestore rules tests (above).
- Test data must be made up (the anonymized sample values already used in `test/`).

## Clarifications and calls made after review

Answered by the conversation with the owner:
- **Both people see everything.** There is a single shared `household` claim; the identity used to sign in is never mapped to a `cardHolder`, and the rules do not filter by holder. Grouping by holder is purely a presentation choice.
- **Both people use Gmail accounts**, so Google sign-in is the only method (`email_verified` is true for Google accounts).

Calls made by me (the owner can change them):
- **Rules ownership:** Terraform keeps creating the Firestore database; the security rules are deployed **only with the Firebase CLI** (`firebase deploy --only firestore:rules,hosting`). Terraform never manages rules, so they cannot conflict. `firebase.json` already has an emulators block used by `npm run test:store`; the rules tests reuse the same Firestore emulator, and the builder must check that the existing store tests (which use the server client and bypass rules) still pass once `firestore.rules` is configured.
- **Fallback if reading a custom claim in the rules does not work:** an allowlist document in Firestore (for example `config/household`) containing **user IDs** (not emails, so nothing personal enters the repo), read from the rules with `get()`. The `grant-access` script would then write that document instead of setting a claim. In addition to the emulator tests, the runbook includes a manual check against the deployed project (a signed-in account without access must be denied) because emulator tests can fake claims.
- **Deployment:** manual, from the owner's machine, with the Firebase CLI and the project chosen by `--project` or an environment variable (no CI, no custom domain). The runbook and README use `<project-id>` placeholders; the default Hosting URLs are authorized automatically for sign-in, and the runbook mentions checking the authorized domains list.
- **Totals are computed per currency.** Today every purchase is `ARS`; if another currency ever appears, a section header shows one total per currency instead of adding different currencies together.
- **A document without `status` is treated as approved**, like the ingestion service does.
- **Reading all of `expenses` is acceptable for this first version** (a few purchases a day, far below the free Firestore read quota). A month filter is the natural next step if the volume grows.

## Left to the builder
- Folder layout inside `web/`, how data is fetched (`onSnapshot` or `getDocs`), loading and error states, styling details, accessibility details.
- Which Google APIs Terraform must additionally enable (for example Firebase-related ones), if any; Terraform changes are optional because the manual steps are documented.
- ESLint/formatting setup.
