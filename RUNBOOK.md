# Deployment runbook — card expense ingestion

Required tools: Node.js, Terraform ≥ 1.5, Google Cloud CLI (`gcloud`), all with your personal Google account.

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

1. Wait for a real purchase (or forward yourself a "Compra aprobada" email that matches the filter). In the Firestore console the `purchases` map of the document `months/<YYYY-MM>` must get a new entry with `merchant`, `amount`, `currency`, `cardLast4`, `purchaseDate` and `receivedAt` within a few seconds.
2. **Idempotency:** in Pub/Sub, publish again to the `gmail-notifications` topic a message `{"emailAddress":"user@example.com","historyId":"<a number greater than the one stored in state/sync>"}`. There must still be only one entry per email in `purchases`.
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
   Existing purchases are never overwritten.

## Web app (read-only tables)

Manual one-time steps. Use your own project ID wherever `<project-id>` appears; never commit it.

1. **Add Firebase to the existing Google Cloud project.** In the Firebase console choose *Create a project → Add Firebase to Google Cloud project*, pick `<project-id>` and confirm.
2. **Enable Google sign-in.** In *Build → Authentication → Sign-in method* enable **Google** (choose a support email) and save. In *Authentication → Settings → Authorized domains* check that `<project-id>.web.app`, `<project-id>.firebaseapp.com` and `localhost` are listed (they are added by default).
3. **Register the web app.** In *Project settings → Your apps* click the Web icon, give it a nickname and register it. Copy `web/.env.example` to `web/.env` and fill in the four values of the config it shows (`apiKey`, `authDomain`, `projectId`, `appId`). `web/.env` is git-ignored.
4. **Deploy** (rules and site), from the project root in PowerShell:
   ```powershell
   npm --prefix web install
   npx firebase login
   npm run web:deploy -- --project <project-id>
   ```
   The command prints the Hosting URL. The rules in `firestore.rules` overwrite whatever rules the project had.
5. **Sign in once with each account** at that URL. Both will see "Sin acceso" (no access); that is expected, it creates their Firebase accounts.
6. **Authorize each person**, still in PowerShell from the project root (needs your gcloud credentials, see step 2 of the one-time steps above):
   ```powershell
   gcloud auth application-default set-quota-project <project-id>   # once; the Admin SDK needs a quota project
   $env:GCP_PROJECT_ID = '<project-id>'
   node scripts/grant-access.js <email-of-person>
   ```
   If the script fails with anything other than "No Firebase account found", the error is shown as it is (for example a credentials or quota-project problem).
   Then press "Volver a comprobar" in the app (or sign in again) to get a token with the new claim.
7. **Manual security check of the deployed rules** (the emulator tests can fake claims, and the app never even asks Firestore for data when someone is unauthorized, so the UI alone proves nothing about the rules). Query Firestore directly with real tokens:
   1. Sign in to the app with a **third Google account** that has not been authorized (it sees "Sin acceso"). In the browser developer tools open *Application → IndexedDB → firebaseLocalStorageDb → firebaseLocalStorage*, open the `firebase:authUser:...` entry and copy `stsTokenManager.accessToken` (its ID token; the exact path can vary between SDK versions).
   2. In PowerShell:
      ```powershell
      $token = '<the token>'
      curl.exe -s -o NUL -w "%{http_code}`n" -H "Authorization: Bearer $token" "https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents/months"
      curl.exe -s -o NUL -w "%{http_code}`n" "https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents/months"
      ```
      Both must print **403** (the second one is the signed-out case). Repeat the first command with the token of an **authorized** account: it must print **200**.
   Tokens expire after one hour and are as sensitive as a password: do not paste them anywhere.
8. **Revoking access:** `node scripts/grant-access.js --revoke <email>`. A token that was already issued keeps working for up to one hour, so the person can still read data until it expires.

### Web app collections

The app stores everything in a few documents instead of one collection per kind of data (the web only does one-off reads, no listeners):

- `months/{YYYY-MM}`: one document per calendar month (Buenos Aires time) of the purchase date. Maps: `purchases` (the bank data; written **only** by the ingestion service), `edits` (category/note per purchase, written by the web), `incomes`, `savings`, `fixed` (amount per fixed-expense type), plus `rate` / `cap` (exchange rate and spending cap of the month) with their `rateInherited` / `capInherited` flags.
- `config/cards` (`accounts`, `cards`, `cycles` and `seenCards`; `seenCards` is written only by ingestion), `config/categories` (categories are archived, never deleted), `config/fixedTypes`, `config/merchants` (the merchant dictionary) and `config/months` (the list of existing months).
- `meta/uncategorized`: the purchases still waiting for a category.
- `state/sync`: the ingestion cursor (not readable from the web).

The old collections (`expenses`, `categories`, `accounts`, `cards`, `cycles`, `merchantCategories`, `fixedTypes`, `fixedExpenses`, `exchangeRates`, `spendingCaps`, `incomes`, `savings`) are no longer used and `firestore.rules` denies them; see "Corte a documentos por mes" for how they are migrated and later deleted. The updated `firestore.rules` must be deployed before using the app: `npm run web:deploy -- --project <project-id>`. Set `VITE_OWNERS` in `web/.env` before building (the names of the people whose incomes are tracked).

### Merchant dictionary (ingestion service)

New purchases get their category from the dictionary in `config/merchants` (`items`, keyed by merchant) when the merchant is already in it. That lookup runs in the ingestion function (an ordinary purchase costs 2 reads, `config/merchants` and its `months/{YYYY-MM}`, and 1 write), so after changing `src/` redeploy it: from `terraform/`, run `terraform plan` (it should only replace the source object in the bucket and update the two functions) and then `terraform apply`. Archiving a category in the app removes the merchants that point to it from the dictionary in the same batch.

Manual check (same technique as step 7 above): with the token of the **third, unauthorized** account, writes must be denied. In PowerShell:
```powershell
$token = '<the token>'
curl.exe -s -o NUL -w "%{http_code}`n" -X PATCH -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"fields\":{\"items\":{\"mapValue\":{}}}}" "https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents/config/categories"
curl.exe -s -o NUL -w "%{http_code}`n" -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"fields\":{}}" "https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents/months"
curl.exe -s -o NUL -w "%{http_code}`n" -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"fields\":{}}" "https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents/meta"
```
All three must print **403**. Do not repeat this with an authorized token: it could create junk documents.

Local development: `npm --prefix web run dev` (uses the real Firebase project configured in `web/.env`).

## Corte a documentos por mes

Se hace una sola vez y a mano, con la ingesta detenida un rato. Hacerlo desde la rama `feat/month-documents`, **sin hacer merge a `main`** hasta terminar el paso 12: así `main` sigue siendo la vuelta atrás. Todo desde la raíz del repo, en PowerShell, salvo donde se indique otra cosa. Requisitos: `gcloud auth login`, `gcloud auth application-default login`, `gcloud config set project <project-id>`, `terraform/terraform.tfvars` completo y `web/.env` con `VITE_OWNERS`. Antes de empezar: `npm test`, `npm run test:rules` y `npm --prefix web test` deben pasar.

### Ensayo (producción solo se lee)

1. Volcado fresco de producción, solo lectura:
   ```powershell
   $env:GCP_PROJECT_ID = '<project-id>'
   npm run dev:dump
   ```
   Anotar los conteos que imprime por colección (`expenses`, `incomes`, `savings`, ...): se comparan con los conteos de `migrate` (pasos 3 y 7).
2. Terminal A: levantar los emuladores y dejarlos corriendo.
   ```powershell
   npm run dev:emulators
   ```
   Usa `--import=emulator-state --export-on-exit`: la primera vez la carpeta no existe y no pasa nada; el estado se guarda al cerrar con Ctrl+C y se recarga la próxima vez. Por eso el paso 3 siembra siempre: el seed borra primero todo lo que haya en el emulador y carga el volcado.
3. Terminal B (nueva, sin `GCP_PROJECT_ID`: `migrate` se niega a correr si están las dos variables):
   ```powershell
   npm run dev:seed
   $env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
   npm run migrate
   Remove-Item Env:FIRESTORE_EMULATOR_HOST
   ```
   `migrate` debe imprimir `Target: EMULATOR 127.0.0.1:8080 (project demo-gastos)`. Si dice `PRODUCTION`, parar. Revisar los conteos como en el paso 7.
4. Terminal B: `npm run dev:web`, abrir la URL que imprime e ingresar con una cuenta del hogar (el seed las crea en el emulador de Auth). Comparar lado a lado con la app de producción actual: **Inicio, Gastos, Balance e Histórico** deben mostrar los mismos números. Cerrar con Ctrl+C `dev:web` y los emuladores.

### Corte (producción)

5. **Respaldo** con las colecciones viejas, y copia aparte (el volcado del paso 8 pisa estos archivos):
   ```powershell
   $env:GCP_PROJECT_ID = '<project-id>'
   npm run dev:dump
   New-Item -ItemType Directory -Force emulator-data/pre-corte
   Copy-Item emulator-data/firestore.json, emulator-data/auth.json emulator-data/pre-corte/
   ```
   (`emulator-data/` está en `.gitignore`: contiene datos reales, no se sube.)
6. **Frenar la ingesta y la app.** Cerrar la app y avisarle a la otra persona del hogar que no la use hasta que termine el paso 9: la app vieja sigue escribiendo en las colecciones viejas y esos cambios no llegarían a los documentos por mes. Anotar la hora. Esto convierte la suscripción push en pull (los avisos quedan retenidos en la suscripción, hasta 24 h: `message_retention_duration = 86400s`) y pausa el job diario. Ejecutarlo en **Git Bash**: PowerShell 5.1 descarta el argumento vacío `""`.
   ```bash
   gcloud pubsub subscriptions modify-push-config gmail-notifications-push --push-endpoint=""
   gcloud scheduler jobs pause renew-watch-daily --location=us-central1
   ```
   Comprobar que no queda endpoint (debe imprimir una línea vacía) y que el job figura `PAUSED`:
   ```powershell
   gcloud pubsub subscriptions describe gmail-notifications-push --format="value(pushConfig.pushEndpoint)"
   gcloud scheduler jobs describe renew-watch-daily --location=us-central1 --format="value(state)"
   ```
   (`us-central1` es el default de `var.region`; si en `terraform.tfvars` hay otra región, usar esa.)
7. **Migrar.** Debe decir `Target: PRODUCTION project <project-id>`:
   ```powershell
   $env:GCP_PROJECT_ID = '<project-id>'
   npm run migrate
   ```
   Revisar el JSON de conteos: `purchases` debe ser igual al `expenses` del volcado, `incomes` y `savings` iguales a los del volcado, y `months` el número de meses con datos. Al final imprime `Wrote N documents.` Si algo no coincide, parar (la migración se puede volver a correr, **solo antes del paso 9**: sobrescribe los mismos documentos y las colecciones viejas no se tocan; una vez desplegada la web nueva o la ingesta nueva, lo que escriben vive solo en `months/*` y volver a migrar lo pisaría).
8. **Paridad sobre la producción migrada.** El volcado ahora trae también `months`, `config` y `meta`, y el test usa esos documentos:
   ```powershell
   npm run dev:dump
   npm test -- test/parity.months.test.ts
   ```
   Debe pasar sin tests omitidos (`skipped`). Si falla, parar y no desplegar.
9. **Reglas y web nuevas** (las reglas nuevas niegan las colecciones viejas). Antes de desplegar: si alguien usó la app después del paso 7, volver a correr `npm run migrate` y el paso 8 (paridad), y recién entonces desplegar.
   ```powershell
   npm run web:deploy -- --project <project-id>
   ```
10. **Ingesta nueva.** Desde `terraform/`:
    ```powershell
    cd terraform
    terraform plan
    terraform apply
    cd ..
    ```
    El plan debe reemplazar el objeto del código en el bucket, actualizar las dos funciones y cambiar la suscripción `gmail-notifications-push`: el `apply` le restaura el `push_endpoint`. Los avisos retenidos empiezan a llegar solos. Después reanudar el job:
    ```powershell
    gcloud scheduler jobs resume renew-watch-daily --location=us-central1
    ```
11. **Cubrir la ventana detenida.** `<N>` = días completos desde el paso 6, redondeado hacia arriba, más 1 (un corte de una hora: `--days 2`). No pisa compras existentes.
    ```powershell
    $env:GCP_PROJECT_ID = '<project-id>'
    $env:GMAIL_USER = '<your-gmail-address>'
    node scripts/reprocess.js --days <N>
    ```
12. **Verificación manual** en la app desplegada:
    - Costo de lecturas: en la consola de Firebase, *Firestore Database → Uso*, anotar las lecturas del día; abrir **Inicio** con recarga completa (Ctrl+F5) y esperar unos minutos a que el gráfico se actualice. Debe sumar **≈ 10 lecturas** (5 documentos de configuración, `meta/uncategorized` y 3 o 4 meses). Si suma cientos, algo sigue leyendo de más: revisar antes de seguir.
    - Entra una compra nueva (o mirar una de la ventana del paso 11): aparece al recargar.
    - En *Compras a categorizar*, categorizar una compra: desaparece de la lista y sigue categorizada al recargar.
    - En *Presupuesto → Ingresos y ahorro*, cargar un ingreso de un mes futuro: el mes aparece y se puede borrar el ingreso de prueba.
    - Opcional: la comprobación manual de reglas del apartado "Web app" (paso 7).
    Con todo bien, recién ahí hacer el merge a `main`.
13. **Limpieza (unos días después, sin problemas).** Las colecciones viejas quedan como respaldo, sin uso. Se borran a mano desde la consola de Firestore (*Eliminar colección*): `expenses`, `categories`, `accounts`, `cards`, `cycles`, `merchantCategories`, `fixedTypes`, `fixedExpenses`, `exchangeRates`, `spendingCaps`, `incomes`, `savings`. **No** borrar `state` (`state/sync` la usa la ingesta), `months`, `config` ni `meta`.

### Vuelta atrás

Solo es limpia **antes del paso 11**: las colecciones viejas siguen intactas y nada las modificó. Después de `reprocess`, las compras nuevas viven solo en `months/*`. Lo que se haya hecho en la app nueva después del corte (categorías, ingresos, ahorros, ediciones, etc.) vive solo en `months/*`, `config/*` y `meta/*` y no aparecerá al volver atrás: hay que rehacerlo a mano.

```powershell
git switch main
npm run web:deploy -- --project <project-id>
cd terraform
terraform apply
cd ..
gcloud scheduler jobs resume renew-watch-daily --location=us-central1
```

`terraform apply` desde `main` también restaura el `push_endpoint`. Si la función nueva ya llegó a recibir avisos (paso 10), esas compras quedaron solo en `months/*`: recuperarlas desde `main` con `node scripts/reprocess.js --days <N>` (mismas variables que el paso 11). Los documentos migrados (`months`, `config`, `meta`) pueden quedar: no estorban y un nuevo `npm run migrate` los sobrescribe.

## Local tests

- `npm test` — parser, decoding, sync and handlers (nothing else required).
- `npm run test:store` — data layer against the Firestore emulator (requires Java).
- `npm run test:rules` — Firestore security rules against the emulator (requires Java).
- `npm --prefix web test` — web app tests.

## If something fails

- No new purchases in Firestore but no alerts: check that the `watch` is active (run the Scheduler job) and that the `Gastos BBVA` label is being applied to the emails.
- `invalid_grant` in the logs: the refresh token was revoked or expired; repeat step 7 and check that the app is "In production".
- Pub/Sub stops retrying after 24 h; the daily reconciliation recovers the last 3 days.
