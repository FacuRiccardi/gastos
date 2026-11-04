# Cards section: accounts, cards and statement dates — Design

Date: 2026-11-03

## Intent and why

The web app (see `design/web-app-spec.md`) shows the purchases grouped by person + card. The owner wants to count expenses **by credit card billing cycle** (statement period). For that the app must know, for each credit account, the **closing date** (fecha de cierre, "corte") and the **due date** (fecha de vencimiento) of every period, and which cards belong to which account.

The bank's notification emails carry the card's last 4 digits, the card type and the holder's first name, but nothing about accounts or cycles. The owner decided to load those dates **by hand** for now (an automatic source, such as a "statement available" email, may come later).

This feature is the **Cards section**: view accounts and their cards, assign cards to accounts, and load the statement dates. The by-cycle expense summary is a later feature that will use this data.

The repository is public: no personal data (names, card digits, dates, project IDs) may be committed.

## Scope

**Included:** a "Cards" section in the web app (view and edit), the Firestore data model for accounts, cards and cycles, Firestore rules that allow the two authorized people to write **only** those collections with strict validation, tests, privacy-policy and runbook updates.

### Non-goals (later)
- Expense totals by cycle, any use of the dates in the expense tables, alerts.
- Automatic loading of dates (parsing statement emails), reminders to load the next dates.
- Editing or deleting expenses. Expenses stay read-only.
- Debit accounts' statement logic: debit cards can be assigned to an account but have no dates.

### Anti-goals (a failure even if it "works")
- The Cards section lets anyone other than the two authorized people read or write anything.
- Any write to `expenses` or `state/sync` becomes possible from the browser.
- A document with extra, missing or badly typed fields (or a malformed date) can be written to the new collections (the rules must reject it, not only the UI).
- Deleting an account leaves orphan cards or cycles that make the screen inconsistent.
- Personal data in the repository.

## What the user sees

A second section of the app, reachable from a simple navigation next to the expenses (for example tabs "Gastos" and "Tarjetas"; no router needed). Texts are in Argentine Spanish, in `web/src/strings.ts`.

```
Cuenta de <name>   (owner: JUAN)                    [Editar] [Eliminar]
  Tarjetas
    ····1234  Crédito  Asignada a: JUAN        [Cambiar] [Quitar]
    ····5678  Crédito  Asignada a: MARIA         [Cambiar] [Quitar]
    ····9012  Débito   Asignada a: JUAN        [Cambiar] [Quitar]
  Fechas de corte y vencimiento
    Cierre        Vencimiento
    15/11/2026    25/11/2026                      [Borrar]
    15/12/2026    26/12/2026                      [Borrar]
    [+ Agregar fecha]   [Cargar varias]

Tarjetas sin cuenta (detectadas en tus gastos)
    ····4321  Crédito  MARIA         [Asignar a una cuenta ▾]

[+ Nueva cuenta]
```

- **Accounts** are created by hand with a name and an owner (a person's first name, stored in upper case as the bank writes it, for example `JUAN`). They can be edited and deleted.
- **Cards** do not have to be typed in: the app detects every distinct combination of last 4 digits, card type and holder present in the expenses and lists those that are not yet in any account under "cards without an account", with an account selector to assign them in one click. The holder shown for a card comes from the expense data and can be changed. A card can be removed from an account (it goes back to "without an account").
- **Dates** belong to the **account**, so an additional card shares its owner's cycle. Each cycle has a closing date (required) and a due date (optional, "we do not use it yet but we want the data"). Only credit accounts' dates matter; the app does not enforce it.
- **Adding dates:** a form to add one cycle (two date inputs) and a **bulk** form: a text area, one cycle per line as `dd/mm/yyyy dd/mm/yyyy` (closing, then due) or only `dd/mm/yyyy` (closing without due date), meant for loading the 12 dates of a year at once. If any line is invalid, nothing is saved and the invalid lines are listed. Duplicated closing dates for the same account are rejected.
- Dates are shown as `dd/mm/yyyy`, ordered by closing date (oldest first, or newest first, the builder decides and keeps it consistent).
- Empty states, loading and error states (including a permission error) for every list.

## Data model (Firestore)

Calendar dates are stored as **`YYYY-MM-DD` strings** (a date on the calendar, without a time zone), not Timestamps (my call; the by-cycle feature compares them with the purchase dates after converting those to Buenos Aires calendar days).

- `accounts/{accountId}`: `{ name: string (1–40 chars), owner: string (1–40 chars) }`. The app stores the owner in upper case (as the bank writes holder names); that is done by the UI, the rules only check the size.. The ID is generated.
- `cards/{last4}_{type}` (for example `1234_credit`): `{ last4: string (4 digits), type: "credit" | "debit", holder: string (1–40), accountId: string }`. The document ID must equal `${last4}_${type}`.
- `cycles/{accountId}_{closingDate}`: `{ accountId: string, closingDate: "YYYY-MM-DD", dueDate: "YYYY-MM-DD" | null }`. The ID makes a closing date unique per account.
- Cards and cycles are top-level collections that point to an account by `accountId`.

## Firestore rules

Same `isHousehold()` condition as today (signed in, verified email, claim `household`). For `accounts`, `cards` and `cycles`:
- **read:** `isHousehold()`.
- **create:** `isHousehold()` and the document has **exactly** the fields above (no extra, none missing), each with the right type and size; dates match `^\d{4}-\d{2}-\d{2}# Cards section: accounts, cards and statement dates — Design

Date: 2026-11-03

## Intent and why

The web app (see `design/web-app-spec.md`) shows the purchases grouped by person + card. The owner wants to count expenses **by credit card billing cycle** (statement period). For that the app must know, for each credit account, the **closing date** (fecha de cierre, "corte") and the **due date** (fecha de vencimiento) of every period, and which cards belong to which account.

The bank's notification emails carry the card's last 4 digits, the card type and the holder's first name, but nothing about accounts or cycles. The owner decided to load those dates **by hand** for now (an automatic source, such as a "statement available" email, may come later).

This feature is the **Cards section**: view accounts and their cards, assign cards to accounts, and load the statement dates. The by-cycle expense summary is a later feature that will use this data.

The repository is public: no personal data (names, card digits, dates, project IDs) may be committed.

## Scope

**Included:** a "Cards" section in the web app (view and edit), the Firestore data model for accounts, cards and cycles, Firestore rules that allow the two authorized people to write **only** those collections with strict validation, tests, privacy-policy and runbook updates.

### Non-goals (later)
- Expense totals by cycle, any use of the dates in the expense tables, alerts.
- Automatic loading of dates (parsing statement emails), reminders to load the next dates.
- Editing or deleting expenses. Expenses stay read-only.
- Debit accounts' statement logic: debit cards can be assigned to an account but have no dates.

### Anti-goals (a failure even if it "works")
- The Cards section lets anyone other than the two authorized people read or write anything.
- Any write to `expenses` or `state/sync` becomes possible from the browser.
- A document with extra, missing or badly typed fields (or a malformed date) can be written to the new collections (the rules must reject it, not only the UI).
- Deleting an account leaves orphan cards or cycles that make the screen inconsistent.
- Personal data in the repository.

## What the user sees

A second section of the app, reachable from a simple navigation next to the expenses (for example tabs "Gastos" and "Tarjetas"; no router needed). Texts are in Argentine Spanish, in `web/src/strings.ts`.

```
Cuenta de <name>   (owner: JUAN)                    [Editar] [Eliminar]
  Tarjetas
    ····1234  Crédito  Asignada a: JUAN        [Cambiar] [Quitar]
    ····5678  Crédito  Asignada a: MARIA         [Cambiar] [Quitar]
    ····9012  Débito   Asignada a: JUAN        [Cambiar] [Quitar]
  Fechas de corte y vencimiento
    Cierre        Vencimiento
    15/11/2026    25/11/2026                      [Borrar]
    15/12/2026    26/12/2026                      [Borrar]
    [+ Agregar fecha]   [Cargar varias]

Tarjetas sin cuenta (detectadas en tus gastos)
    ····4321  Crédito  MARIA         [Asignar a una cuenta ▾]

[+ Nueva cuenta]
```

- **Accounts** are created by hand with a name and an owner (a person's first name, stored in upper case as the bank writes it, for example `JUAN`). They can be edited and deleted.
- **Cards** do not have to be typed in: the app detects every distinct combination of last 4 digits, card type and holder present in the expenses and lists those that are not yet in any account under "cards without an account", with an account selector to assign them in one click. The holder shown for a card comes from the expense data and can be changed. A card can be removed from an account (it goes back to "without an account").
- **Dates** belong to the **account**, so an additional card shares its owner's cycle. Each cycle has a closing date (required) and a due date (optional, "we do not use it yet but we want the data"). Only credit accounts' dates matter; the app does not enforce it.
- **Adding dates:** a form to add one cycle (two date inputs) and a **bulk** form: a text area, one cycle per line as `dd/mm/yyyy dd/mm/yyyy` (closing, then due) or only `dd/mm/yyyy` (closing without due date), meant for loading the 12 dates of a year at once. If any line is invalid, nothing is saved and the invalid lines are listed. Duplicated closing dates for the same account are rejected.
- Dates are shown as `dd/mm/yyyy`, ordered by closing date (oldest first, or newest first, the builder decides and keeps it consistent).
- Empty states, loading and error states (including a permission error) for every list.

## Data model (Firestore)

Calendar dates are stored as **`YYYY-MM-DD` strings** (a date on the calendar, without a time zone), not Timestamps (my call; the by-cycle feature compares them with the purchase dates after converting those to Buenos Aires calendar days).

- `accounts/{accountId}`: `{ name: string (1–40 chars), owner: string (1–40 chars) }`. The app stores the owner in upper case (as the bank writes holder names); that is done by the UI, the rules only check the size.. The ID is generated.
- `cards/{last4}_{type}` (for example `1234_credit`): `{ last4: string (4 digits), type: "credit" | "debit", holder: string (1–40), accountId: string }`. The document ID must equal `${last4}_${type}`.
- `cycles/{accountId}_{closingDate}`: `{ accountId: string, closingDate: "YYYY-MM-DD", dueDate: "YYYY-MM-DD" | null }`. The ID makes a closing date unique per account.
- Cards and cycles are top-level collections that point to an account by `accountId`.

## Firestore rules

Same `isHousehold()` condition as today (signed in, verified email, claim `household`). For `accounts`, `cards` and `cycles`:
- **read:** `isHousehold()`.
; a due date, when present, is not before the closing date (string comparison); `cards` and `cycles` document IDs match their fields; for `cards` and `cycles` the referenced account exists (`exists(...)`).
- **update:** `accounts`: `name` and `owner` may change. `cards`: only `holder` and `accountId` may change (`last4` and `type` are fixed because they are part of the ID); the same field/type checks and the account must exist. `cycles`: **no updates** (they are immutable: to correct a date, delete the cycle and add it again). Because an `update` is denied, writing over an existing cycle ID is rejected by the rules, which is what makes "no duplicate closing date per account" a server-side guarantee.
- **delete:** `isHousehold()`.
- Everything else, including `expenses` writes and `state/sync`, stays denied exactly as today.
- The existing rules tests keep passing; new tests cover, for each new collection: authorized create/update/delete succeeds; signed out, no claim, unverified email are denied; extra field, missing field, wrong type, bad date, wrong ID and a reference to a missing account are denied.

## Consistency of deletes

Deleting an account removes its cycles and sends its cards back to "without an account" in **one batched write** (a client-side batch; the rules allow it). A card removed from an account is deleted from `cards` (the app re-detects it from the expenses). The builder verifies that a batch is enough or uses a transaction.

## Technology and structure

Same stack as the web app (React, TypeScript, shadcn/ui, Firebase modular SDK, Vitest, emulator-based rules tests). Follow the **official shadcn documentation at the time of the work** for any new component (likely: tabs, input, label, select, dialog or sheet, alert-dialog for confirmations, textarea); do not rely on memory.

As in the web app, the data layer is **injected** (an interface with `subscribe` for each collection and the write operations) so components are tested with fakes, and the pure logic is tested on its own:
- `findUnassignedCards(expenses, cards)` (distinct last4 + type + holder not present in `cards`).
- `parseCyclesText(text)` (the bulk format, with per-line errors, `dd/mm/yyyy` to `YYYY-MM-DD`, impossible dates such as 31/02 rejected).
- date validation and formatting helpers.

## Clarifications and calls made after review

Decided by me (the owner can change them):
- **Card identity is last 4 digits + type** (`1234_credit`). The holder is a changeable field, not part of the identity. `findUnassignedCards` therefore matches on last 4 + type only and ignores the holder; when a card is first assigned, its holder is taken from the most recent expense that has that card. If the expenses ever show two holders for the same last 4 + type, the card appears as one row and the stored holder wins (the expense tables keep grouping by holder + card as today).
- **"Cambiar" on a card** opens a dialog where both the **holder** (the person it is assigned to) and the **account** can be changed. "Quitar" deletes the card document: the card goes back to "without an account" and its holder is taken from the expenses again, so a holder edit made before is lost (intended).
- **Duplicate closing dates:** the UI checks the dates already loaded and rejects a closing date that already exists for the account, both when adding one and in bulk (in bulk, a clash with a stored cycle or between two lines fails the whole batch and lists the lines). The rules back this up (cycles cannot be updated).
- **Orphans:** a batched delete is not atomic against a concurrent add by the other person, so a rare orphan card or cycle is possible. The UI ignores cycles whose account does not exist, and a card whose account does not exist counts as "without an account" (so it shows up again to be assigned).
- **Upper case** of owner names is applied by the UI; the rules do not enforce it (accents and Ñ are fine).
- A card with a blank holder in the expenses is assumed not to happen.

## Left to the builder
- Navigation details, layout, dialogs vs inline forms, order of lists, accessibility.
- How the owner/holder name inputs help the user (free text with suggestions taken from names already seen is fine).
- Batch vs transaction for deletes; module layout inside `web/src`.

## Documentation to update
- `docs/privacy.html` ("What data it stores"): the app also stores account names, the assignment of cards to people and statement dates.
- `README.md` and `RUNBOOK.md`: mention the Cards section and that the rules must be redeployed (`npm run web:deploy`).
