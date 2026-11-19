# Datos por mes — Plan de implementación

> **Para quien ejecute:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** reemplazar las 12 colecciones y los listeners por documentos por mes (`months/YYYY-MM`), pocos documentos de configuración y una lista de compras sin categorizar, de modo que abrir el Inicio cueste ≈ 10 lecturas en vez de ≈ 2.300, sin cambiar los números que muestra la app.

**Arquitectura:** la ingesta (Node) guarda cada compra en el documento de su mes dentro de una transacción. La web lee con lecturas únicas a través de una interfaz `Backend` (Firestore en producción, una falsa en memoria en los tests) y un `DataStore` que cachea en memoria la configuración, los meses leídos y la lista de sin categorizar, e implementa las interfaces `*Api` que las pantallas ya usan. Cada pestaña pide solo los meses que necesita y alimenta con ellos las funciones de cálculo actuales (`statements.ts`, `homePeriods.ts`, `categoryBreakdown.ts`, `balance.ts`), que no cambian.

**Stack:** Node 20 + `@google-cloud/firestore` (ingesta), React 19 + TypeScript + Firebase JS SDK (web), Vitest, emulador de Firestore, `@firebase/rules-unit-testing`, Terraform.

**Spec:** `docs/superpowers/specs/2026-11-18-month-documents-design.md`

Trabajar en la rama `feat/month-documents` (ya creada, con el spec commiteado).

Comandos:
- Backend y tests puros de la raíz: `npm test -- <archivo>`
- Ingesta contra el emulador: `npm run test:store`
- Reglas y backend web contra el emulador: `npm run test:rules` (corre todo `test/rules*`)
- Web: `npm --prefix web test -- <archivo>`, `npm --prefix web run build`, `npm --prefix web run lint`

## Restricciones globales

- **Ningún `onSnapshot` en `web/src/`** al terminar. Todas las lecturas son únicas; lo leído vive en memoria durante la vida de la página. Sin persistencia en el dispositivo.
- **Sin dependencias nuevas.**
- **Los números no cambian**, salvo los "Cambios de comportamiento" del spec. La única diferencia aceptada en la paridad es `rate.month`/`rate.exact` (el valor `rate.rate` debe ser igual).
- Mes de una compra = mes calendario de su `purchaseDate` **en Buenos Aires** (UTC-3, sin horario de verano). `purchaseDate` se sigue guardando como `Timestamp` a las 00:00 de Buenos Aires.
- Desde la web **nunca** se escribe `months/*.purchases` ni `config/cards.seenCards`.
- Herencia al crear un mes: copiar `rate` y `cap` del **mes existente más reciente anterior** (`inheritSource`); `rateInherited = rate copiado !== null`, igual para `cap`. Sin mes anterior: `null` y `false`. Guardar un valor desde la web pone la marca en `false`. Cada mes es independiente una vez creado.
- Las categorías no se borran: se **archivan** (`archived: true`). Archivar quita del diccionario los comercios que apuntan a ella, en el mismo lote.
- Ingesta, compra común: **2 lecturas** (`config/merchants`, `months/{mes}`) y **1 escritura**.
- Textos de la interfaz en español, en `web/src/strings.ts`.
- **Los archivos del repo usan finales de línea CRLF:** las ediciones no deben convertirlos.
- Los archivos de `web/src/data/` y los `*Api.ts`/`types.ts` que importan los tests de la raíz usan **imports relativos, sin `@/`**.
- Comentarios: solo cuando el código no puede explicarse solo, una o dos líneas (regla global del usuario).
- Nada se despliega durante la implementación. El corte se hace con el runbook de la Tarea 18.

## Forma de los documentos (contrato entre ingesta, migración, reglas y web)

| Documento | Campos |
|---|---|
| `months/{YYYY-MM}` | `purchases: {<id>: {purchaseDate: Timestamp, receivedAt: Timestamp, merchant, amount, currency, cardLast4, cardType, cardHolder, status}}`, `edits: {<id>: {category?: string, note?: string}}`, `incomes: {<id>: {amount, currency, date, owner}}`, `savings: {<id>: {amount, currency, date}}`, `fixed: {<typeId>: number}`, `rate: number\|null`, `rateInherited: boolean`, `cap: number\|null`, `capInherited: boolean` |
| `config/cards` | `accounts: {<id>: {name, owner}}`, `cards: {<last4_type>: {last4, type, holder, accountId}}`, `cycles: {<accountId_closingDate>: {accountId, closingDate, dueDate}}`, `seenCards: {<last4_type>: {last4, type, holder, lastSeen: 'YYYY-MM-DD'}}` |
| `config/categories` | `items: {<id>: {name, color, archived: boolean}}` |
| `config/fixedTypes` | `items: {<id>: {name, disabled: boolean}}` |
| `config/merchants` | `items: {<merchantKey>: {merchant, categoryId}}` |
| `config/months` | `list: string[]` (meses existentes, sin orden garantizado; los lectores ordenan) |
| `meta/uncategorized` | `items: {<purchaseId>: {month, merchant, amount, currency, purchaseDate: Timestamp, cardLast4, cardType, cardHolder}}` |

Un mes recién creado tiene `purchases`, `edits`, `incomes`, `savings` y `fixed` como mapas vacíos.

## Revisión enfocada

Casos que el spec implica y que ninguna tarea cubriría por defecto. Cada uno tiene su test en la tarea indicada.

1. **Compra del último día del mes cerca de medianoche:** `2026-10-31` en Buenos Aires es `2026-11-01T03:00Z`, y tiene que quedar en `2026-10`, no en noviembre (Tareas 1, 2 y 5).
2. **Reprocesar una compra ya categorizada** (reintento de Pub/Sub o `reprocess.js`): conserva su categoría y no vuelve a `meta/uncategorized` (Tarea 3).
3. **Período que cruza el año** (24/12–23/1): el Inicio pide `2026-12` y `2027-01` (Tarea 6).
4. **Grupo del Inicio cuyo mes todavía no existe** (justo después del cierre): se lee el mes del que heredaría, y el total en pesos usa ese tipo de cambio (Tareas 6 y 7).
5. **Categorizar desde Categorías una compra de un mes no leído:** la escritura funciona, la lista se actualiza y, si ese mes se lee después, muestra la categoría (Tarea 9).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/months.js` (nuevo) + `web/src/data/months.ts` (nuevo) | Funciones puras gemelas: mes de un día, mes del que se hereda |
| `src/store.js`, `src/sync.js` | Ingesta sobre la estructura nueva |
| `scripts/lib/migration.js` (nuevo), `scripts/migrate-to-months.js` (nuevo) | Migración pura y su ejecución |
| `scripts/lib/dumpFormat.js`, `scripts/dump-prod.js`, `scripts/seed-emulator.js` | Volcado y siembra con las colecciones nuevas |
| `firestore.rules` | Reglas nuevas |
| `web/src/data/types.ts` (nuevo) | `MonthId`, `MonthData`, `AppConfig`, `SeenCard`, `UncategorizedItem` |
| `web/src/data/monthDoc.ts` (nuevo) | Documento crudo → tipos de la app; tipos de la app → listas que usan los cálculos |
| `web/src/data/monthsFor.ts` (nuevo) | Qué meses necesita cada pantalla |
| `web/src/data/backend.ts`, `fakeBackend.ts`, `firestoreBackend.ts` (nuevos) | Interfaz de acceso a datos y sus dos implementaciones |
| `web/src/data/dataStore.ts`, `DataProvider.tsx` (nuevos) | Caché en memoria, mutaciones, hooks de React |
| `web/src/*/…Tab.tsx` (nuevos) | Contenedores por pestaña: piden meses y pasan datos a las pantallas actuales |
| `test/parity.months.test.ts` (nuevo) | Paridad viejo/nuevo sobre el volcado de producción |
| `RUNBOOK.md`, `terraform/main.tf` | Corte y archivo nuevo de la función |

---

## Etapa 1 — Contrato y migración (sin efecto en la app)

### Tarea 1: Funciones de mes gemelas (Node y web)

**Archivos:**
- Crear: `src/months.js`, `web/src/data/months.ts`
- Modificar: `terraform/main.tf` (agregar `months.js` a `local.src_files`)
- Test: `test/months.twin.test.js`

**Interfaces:**
- Produce (idéntico en los dos lados):
  - `monthOfDay(day: string): string`: `'2026-10-31'` → `'2026-10'`
  - `monthOfInstant(date: Date): string`: mes calendario en Buenos Aires de un instante
  - `inheritSource(existing: string[], target: string): string | null`: el mayor de `existing` estrictamente menor que `target`, o `null`

- [ ] **Paso 1: test que falla.** Con el mismo patrón que `test/merchantKey.twin.test.js`, en `test/months.twin.test.js`:
  - `monthOfInstant(new Date('2026-11-01T02:59:59Z'))` → `'2026-10'`; `monthOfInstant(new Date('2026-11-01T03:00:00Z'))` → `'2026-11'`; `monthOfInstant(new Date('2027-01-01T02:00:00Z'))` → `'2026-12'`
  - `inheritSource(['2026-09','2026-11','2026-07'], '2026-12')` → `'2026-11'`; `(…, '2026-10')` → `'2026-09'`; `(…, '2026-07')` → `null`; `([], '2026-01')` → `null`
  - los tres casos dan lo mismo en los dos lados (`it.each`)
- [ ] **Paso 2:** `npm test -- test/months.twin.test.js` → FALLA (módulos inexistentes).
- [ ] **Paso 3:** implementar los dos archivos y agregar `"months.js"` a `local.src_files` en `terraform/main.tf`.
- [ ] **Paso 4:** `npm test -- test/months.twin.test.js` → PASA.
- [ ] **Paso 5:** commit `feat: shared month helpers for ingestion and web`.

### Tarea 2: Migración pura

**Archivos:**
- Crear: `scripts/lib/migration.js`
- Test: `test/migration.test.js`

**Interfaces:**
- Consume: `monthOfInstant`, `monthOfDay` de `src/months.js`.
- Produce: `migrate(collections): { months: Record<string, object>, config: { cards, categories, fixedTypes, merchants, months }, uncategorized: object, counts: Record<string, number> }`. `collections` es `{ [nombreViejo]: {id, data}[] }` con `Timestamp` de `firebase-admin/firestore` (lo que devuelve `decode` de `dumpFormat.js`). Cada valor de salida es el contenido exacto del documento según la tabla "Forma de los documentos".

Reglas de la migración (del spec):
- Compra → `months[monthOfInstant(purchaseDate.toDate())].purchases[id]` con los 9 campos del banco (sin `categoryId`).
- `categoryId` que existe en `categories` → `edits[id].category`. Compra aprobada sin `categoryId`, o con uno que no existe → entrada en `uncategorized.items`. Rechazadas: nunca en la lista.
- `incomes`/`savings` → mes de su `date` (`monthOfDay`), sin el campo `source` ni otros extra (solo `amount, currency, date` y `owner` en ingresos). `fixedExpenses` → `months[month].fixed[typeId] = amount`.
- Meses creados: todo mes con compras, ingresos, ahorros, fijos, tipo de cambio o tope.
- `rate`: el propio; si no hay, el del último mes anterior con tipo de cambio; si no hay anterior, el del último mes cargado. `rateInherited = !propio && rate !== null`.
- `cap`: el propio; si no, el último anterior; si no, `null`. `capInherited = !propio && cap !== null`.
- `seenCards`: una por `last4_type` vista en las compras, con titular y `lastSeen` (día de Buenos Aires) de la compra más reciente.
- `categories`: `archived: false`. `fixedTypes`: `disabled` (por defecto `false`). `merchants`: tal cual.
- `counts`: documentos leídos por colección vieja y entradas escritas (`purchases`, `edits`, `uncategorized`, `incomes`, `savings`, `fixed`, `months`).

- [ ] **Paso 1: tests que fallan** en `test/migration.test.js`, con colecciones sintéticas chicas:
  - `puts a purchase of 31/10 at 00:00 Buenos Aires in 2026-10`
  - `moves categoryId to edits and leaves purchases without it`
  - `lists approved purchases without a category or with a missing one as uncategorized, never rejected ones`
  - `fills rate from the latest earlier month, else the latest loaded, and marks it inherited`. Tasas `{2025-12: 1400, 2026-06: 1200, 2026-08: 1300}` y meses 2025-11, 2026-07 y 2026-08: 2025-11 → 1300 heredada, 2026-07 → 1200 heredada, 2026-08 → 1300 propia.
  - `fills cap only from earlier months`. Tope `{2026-10: 2500000}`: 2026-09 → `null`/`false`, 2026-11 → 2500000/`true`.
  - `builds seenCards with the holder and day of the latest purchase`
  - `counts what it read and wrote`. La suma de `purchases` en todos los meses es igual a la cantidad de `expenses`.
  - `is deterministic` (mismo input → mismo output, para poder re-ejecutar).
- [ ] **Paso 2:** `npm test -- test/migration.test.js` → FALLA.
- [ ] **Paso 3:** implementar `migrate` en `scripts/lib/migration.js`.
- [ ] **Paso 4:** `npm test -- test/migration.test.js` → PASA.
- [ ] **Paso 5:** commit `feat: pure migration from collections to month documents`.

---

## Etapa 2 — Ingesta

### Tarea 3: `store.js` sobre documentos por mes

**Archivos:**
- Modificar: `src/store.js`
- Test: `test/store.test.js` (reescribir)

**Interfaces:**
- Consume: `monthOfDay`, `inheritSource` de `src/months.js`.
- Produce (reemplaza a `saveExpense` y elimina `sumByRange`):
  - `getMerchantCategory(key: string): Promise<string | null>`: lee `config/merchants` y devuelve `items[key].categoryId`. Con `key` vacía no lee.
  - `savePurchase(id: string, purchase: {purchaseDate: 'YYYY-MM-DD', receivedAt: Date, merchant, amount, currency, cardLast4, cardType, cardHolder, status}, categoryId: string | null): Promise<boolean>`: `true` si la guardó, `false` si ya existía.
  - `getHistoryId`/`setHistoryId` no cambian.

`savePurchase` hace una sola transacción con los pasos 2 a 6 de "Ingesta" del spec. Las escrituras de mapas usan rutas de campo (`update`/`set` con `merge`), sin leer `meta/uncategorized` ni `config/cards`. La tarjeta se considera "primera del mes" si ninguna compra de `purchases` del mes leído tiene el mismo `cardLast4` y `cardType`.

- [ ] **Paso 1: tests que fallan** (emulador; `beforeEach` limpia `months`, `config`, `meta` y `state`):
  - `creates the month and returns true; a second call returns false and changes nothing` (el monto queda en el primero)
  - `reprocessing a categorized purchase keeps its category and does not list it again`: guardar sin categoría → escribir a mano `edits.<id>.category` y quitar `meta/uncategorized.items.<id>` → `savePurchase` otra vez da `false`, la categoría sigue y la lista no la tiene
  - `stores purchaseDate at 00:00 Buenos Aires in the month of that day` (`'2026-10-31'` → `months/2026-10`, `Timestamp` = `2026-10-31T03:00:00Z`)
  - `copies rate and cap from the latest earlier existing month and marks them inherited` (existen `2026-08` con rate 1300 y cap 2e6, y `2026-06`; guardar en `2026-10` → 1300/`true`, 2e6/`true`; `config/months.list` incluye `2026-10`)
  - `creates a month with null rate and cap when there is no earlier month`
  - `writes the category to edits when given, else lists approved purchases as uncategorized` (una rechazada sin categoría no entra en la lista)
  - `writes seenCards only on the first purchase of a card in the month` (dos compras de la misma tarjeta: `lastSeen` es el de la primera; cambiar `seenCards` a mano entre las dos y comprobar que la segunda no lo pisa)
  - `getMerchantCategory reads config/merchants`
- [ ] **Paso 2:** `npm run test:store` → FALLA.
- [ ] **Paso 3:** implementar en `src/store.js`.
- [ ] **Paso 4:** `npm run test:store` → PASA.
- [ ] **Paso 5:** commit `feat(ingestion): save purchases into month documents`.

### Tarea 4: `sync.js` usa `savePurchase`

**Archivos:**
- Modificar: `src/sync.js:31-33`
- Test: `test/sync.test.js`, `test/sync.merchants.test.js`, `test/index.test.js` (los stores falsos pasan a tener `savePurchase`)

**Interfaces:**
- Consume: `store.getMerchantCategory`, `store.savePurchase(id, {...expense, receivedAt}, categoryId)`.

- [ ] **Paso 1:** actualizar los stores falsos y agregar en `test/sync.merchants.test.js` el test `passes the dictionary category (or null) to savePurchase` (`savePurchase` recibe `'comida'` para un comercio conocido y `null` para uno desconocido).
- [ ] **Paso 2:** `npm test` → FALLA el test nuevo.
- [ ] **Paso 3:** cambiar `processMessage` para llamar a `savePurchase(id, {...expense, receivedAt}, categoryId ?? null)`.
- [ ] **Paso 4:** `npm test` → PASA todo.
- [ ] **Paso 5:** commit `feat(ingestion): use savePurchase`.

---

## Etapa 3 — Reglas

### Tarea 5: `firestore.rules` nuevas

**Archivos:**
- Modificar: `firestore.rules` (reemplazar todos los `match` de colecciones viejas; se mantienen `isHousehold()` y el denegado final)
- Crear: `test/rules.months.test.js`
- Borrar: `test/rules.test.js`, `test/rules.caps.test.js`, `test/rules.cards.test.js`, `test/rules.categories.test.js`, `test/rules.fixed.test.js`, `test/rules.money.test.js`, `test/rules.rates.test.js`, `test/rules.cards-firestore.test.ts`

Reglas (de "Reglas de seguridad" del spec):
- `months/{month}`: lectura del hogar; `month` cumple `^[0-9]{4}-(0[1-9]|1[0-2])$`; `create` solo si las claves están en `[purchases, edits, incomes, savings, fixed, rate, rateInherited, cap, capInherited]` y `purchases` es un mapa vacío; `update` si `!affectedKeys().hasAny(['purchases'])` y las claves siguen en esa lista; `delete` nunca.
- `config/cards`: claves `[accounts, cards, cycles, seenCards]`; `create`/`update` del hogar sin tocar `seenCards` (en `create`, `seenCards` ausente o vacío).
- `config/categories`, `config/fixedTypes`, `config/merchants`, `meta/uncategorized`: claves `[items]`. `config/months`: claves `[list]`, `list is list`. `create`/`update` del hogar; `delete` nunca.
- Todo lo demás, incluidas las colecciones viejas, denegado.

- [ ] **Paso 1: tests que fallan** en `test/rules.months.test.js`, con el mismo armado que el `rules.test.js` actual:
  - sin sesión o sin `household`: no lee `months/2026-10` ni `config/cards`
  - el hogar no puede actualizar `purchases.<id>.amount`, ni agregar una compra, ni crear un mes con `purchases` no vacío, ni borrar un mes
  - el hogar puede actualizar `edits.<id>.category`, `edits.<id>.note`, `incomes.<id>`, `fixed.<typeId>`, `rate` y `capInherited`, y crear un mes vacío
  - el hogar no puede escribir `config/cards.seenCards.<k>` y sí `config/cards.cycles.<k>`
  - el hogar no puede escribir una clave extra en `config/categories` ni en `meta/uncategorized`
  - nadie lee ni escribe `expenses/e1` ni `state/sync`
  - id de mes inválido (`2026-13`) rechazado
- [ ] **Paso 2:** `npm run test:rules` → FALLA.
- [ ] **Paso 3:** reescribir `firestore.rules` y borrar los tests viejos listados.
- [ ] **Paso 4:** `npm run test:rules` → PASA.
- [ ] **Paso 5:** commit `feat(rules): rules for month and config documents`.

---

## Etapa 4 — Capa de datos de la web

### Tarea 6: Tipos, conversión y meses necesarios

**Archivos:**
- Crear: `web/src/data/types.ts`, `web/src/data/monthDoc.ts`, `web/src/data/monthsFor.ts`
- Modificar: `web/src/lib/expense.ts` (agregar `month: string`; `categoryId` sigue siendo el nombre en la app), `web/src/categories/types.ts` (agregar `archived: boolean`)
- Test: `web/src/data/monthDoc.test.ts`, `web/src/data/monthsFor.test.ts`

**Interfaces:**
- Produce en `types.ts`:
```ts
export type MonthId = string
export type MonthData = {
  id: MonthId; expenses: Expense[]; incomes: Entry[]; savings: Entry[]
  fixed: Record<string, number>; rate: number | null; rateInherited: boolean; cap: number | null; capInherited: boolean
}
export type SeenCard = { last4: string; type: 'credit' | 'debit'; holder: string; lastSeen: string }
export type AppConfig = { cards: CardsData; seenCards: SeenCard[]; categories: Category[]; fixedTypes: FixedType[]; merchants: MerchantEntry[]; months: MonthId[] }
export type UncategorizedItem = { id: string; month: MonthId; merchant: string; amount: number; currency: string; purchaseDate: Date; cardLast4: string; cardType: 'credit' | 'debit'; cardHolder: string }
```
- Produce en `monthDoc.ts` (los documentos crudos llegan con fechas "tipo Timestamp" `{ toDate(): Date }`):
  - `toMonthData(id: MonthId, raw: Record<string, unknown>): MonthData`: une `purchases` con `edits` (`categoryId = edits[id]?.category ?? null`), con `month = id`, ordenadas de más nueva a más vieja
  - `toAppConfig(raw: { cards, categories, fixedTypes, merchants, months }): AppConfig`: `months` ordenado ascendente; documentos ausentes → listas vacías
  - `toUncategorized(raw): UncategorizedItem[]`
  - `uncategorizedToExpense(item: UncategorizedItem): Expense` (`receivedAt = purchaseDate`, `status: 'approved'`, `categoryId: null`)
  - `expenseToUncategorized(e: Expense): UncategorizedItem`
  - `expensesOf(months: MonthData[]): Expense[]`, `ratesOf(months): Rates` y `capsOf(months): Caps` (solo valores no `null`), `fixedOf(types: FixedType[], months): FixedData`, `entriesOf(kind: EntryKind, months): Entry[]` (de más nueva a más vieja)
- Produce en `monthsFor.ts` (usa `buildPeriods` de `statements.ts` e `inheritSource`):
  - `homeMonths(cards: CardsData, existing: MonthId[], today: string): MonthId[] | 'all'`: meses existentes que tocan el período actual de cada cuenta (el que contiene `today`, o el abierto desde el día siguiente al último cierre hasta `today`), el último período cerrado de cada cuenta y, para la comparación, el período de cada cuenta que cierra en el mes anterior al mes del grupo actual. Más `inheritSource(existing, m)` para el mes del grupo y el anterior cuando no existen. `'all'` si alguna cuenta no tiene cierres.
  - `groupMonths(cards, month: MonthId, existing): MonthId[] | 'all'`: lo mismo para el grupo de un mes elegido en Gastos (períodos que cierran en `month` y en `month - 1`, más fuentes de herencia).
  - `offeredMonths(cards, existing, today): MonthId[]`: meses de cierre cuyo período toca al menos un mes existente, más el mes del grupo actual; de más nuevo a más viejo.

- [ ] **Paso 1: tests que fallan.**
  - `monthDoc.test.ts`: `joins edits into expenses and sorts newest first`; `a purchase without edits has categoryId null`; `ratesOf skips null rates`; `fixedOf flattens fixed into entries with their month`; `entriesOf sorts newest first`; `toAppConfig sorts months and tolerates missing documents`; `uncategorizedToExpense and expenseToUncategorized round-trip the shared fields`
  - `monthsFor.test.ts` (cuenta A con cierres 2026-09-23, 2026-10-23 y B con 2026-09-25, 2026-10-25):
    - `homeMonths on 2026-11-06 returns 2026-09, 2026-10 and 2026-11 when all exist`
    - `homeMonths across the new year`: cierres 2026-11-23 y 2026-12-23, hoy 2027-01-05, existentes hasta 2027-01 → incluye `2026-12` y `2027-01`
    - `homeMonths adds the inherit source when the group month does not exist yet`: cierres hasta 2026-11-23 y uno futuro 2026-12-23, hoy 2026-11-25, existentes hasta 2026-11 → incluye `2026-11` y nunca `2026-12`
    - `homeMonths returns all for an account without closings`
    - `groupMonths for 2026-10 returns 2026-08, 2026-09 and 2026-10`
    - `offeredMonths keeps the current period even if its closing month does not exist and skips a future closing that touches no existing month`
- [ ] **Paso 2:** `npm --prefix web test -- src/data` → FALLA.
- [ ] **Paso 3:** implementar los tres archivos y los dos campos nuevos. Ajustar los fixtures existentes que construyen `Expense` o `Category` para que compile (`month`, `archived: false`).
- [ ] **Paso 4:** `npm --prefix web test` y `npm --prefix web run build` → PASAN.
- [ ] **Paso 5:** commit `feat(web): month data types, conversion and months per screen`.

### Tarea 7: Paridad sobre el volcado de producción

**Archivos:**
- Crear: `test/parity.months.test.ts`

**Interfaces:**
- Consume: `decode` (`scripts/lib/dumpFormat.js`), `migrate` (Tarea 2), `toMonthData`, `toAppConfig`, `expensesOf`, `ratesOf`, `capsOf`, `fixedOf`, `entriesOf`, `homeMonths`, `groupMonths`, `offeredMonths` (Tarea 6), y las funciones actuales `buildAccountViews`, `buildHomePeriods`, `previousMonthTotal`, `groupForMonth`, `capFor`, `buildBreakdown`, `buildBalance`.

Fuente: `emulator-data/firestore.json`. Si no existe, `describe.skip`. Si el volcado trae `months`/`config`/`meta` (volcado de producción ya migrada), usa esos documentos; si no, los arma con `migrate`. Lado viejo: las colecciones viejas del mismo volcado con el cálculo actual sobre todas las compras. Lado nuevo: **solo los meses que devuelve `homeMonths`/`groupMonths`**, para probar también la selección de meses.

- [ ] **Paso 1: escribir el test.**
  - `home matches for every closing day, the day after, mid-period and 2026-11-04`: para cada `today`, en los dos grupos (`current`, `closed`) son iguales `total`, `usd`, `foreign`, `month`, `latestDue`, los ids de `expenses`, `total` por cuenta, y totales y conteo por tarjeta; `rate.rate` es igual; `previousMonthTotal` es igual; `capFor(group.month)` da el mismo monto.
  - `gastos matches for every offered month`: `groupForMonth`, `previousMonthTotal` y `buildBreakdown(group.expenses, categories, labels, rate)` (slices con `id`, `amount` y `percent` redondeado a 0,01, `top`).
  - `balance matches for every existing month`: con todos los meses, `buildBalance` da iguales `balance`, `incomeTotal`, `fixedTotal`, `cardsTotal`, `missingRate`, `savedThisMonth` y `savedUntilNow`.
  - `migration counts match the source collections`.
- [ ] **Paso 2:** `npm test -- test/parity.months.test.ts` → PASA. Si falla, la diferencia es un error de las Tareas 2 o 6: corregirlo ahí, nunca en el test.
- [ ] **Paso 3:** commit `test: parity between collections and month documents`.

### Tarea 8: Interfaz `Backend`, backend falso y backend de Firestore

**Archivos:**
- Crear: `web/src/data/backend.ts`, `web/src/data/fakeBackend.ts`, `web/src/data/firestoreBackend.ts`
- Modificar: `web/src/categories/categoriesApi.ts`, `web/src/money/entries.ts` (cambian dos firmas, ver abajo)
- Test: `web/src/data/fakeBackend.test.ts`, `test/rules.backend-firestore.test.ts`

**Interfaces:**
- Produce en `backend.ts`:
```ts
export type PurchaseRef = { month: MonthId; id: string }
export interface Backend {
  readConfig(): Promise<AppConfig>                       // 5 lecturas: config/*
  readMonth(id: MonthId): Promise<MonthData | null>      // 1 lectura
  readUncategorized(): Promise<UncategorizedItem[]>      // 1 lectura
  // config/cards: mismas operaciones y efectos que CardsApi hoy (ver firestoreCards.ts)
  cards: CardsApi
  createCategory(input: { name: string; color: string }): Promise<string>
  updateCategory(id: string, input: { name: string; color: string }): Promise<void>
  setCategoryArchived(id: string, archived: boolean, dropMerchantKeys: string[]): Promise<void>
  rememberMerchant(merchant: string, categoryId: string): Promise<void>
  setExpenseCategory(ref: PurchaseRef, categoryId: string | null, listAsUncategorized: UncategorizedItem | null): Promise<void>
  categorizeMerchant(merchant: string, categoryId: string, refs: PurchaseRef[]): Promise<void>
  addFixedType(name: string): Promise<string>
  renameFixedType(id: string, name: string): Promise<void>
  setFixedTypeDisabled(id: string, disabled: boolean): Promise<void>
  setFixed(month: MonthId, typeId: string, amount: number | null): Promise<void>
  addEntry(kind: EntryKind, entry: NewEntry): Promise<string>
  removeEntry(kind: EntryKind, entry: Entry): Promise<void>
  setRate(month: MonthId, rate: number): Promise<void>
  setCap(month: MonthId, amount: number | null): Promise<void>
}
```
- Semántica que comparten las dos implementaciones:
  - `setExpenseCategory`: escribe o borra `edits.<id>.category`. Con categoría, quita `items.<id>` de la lista. Con `null` y `listAsUncategorized`, la agrega. Todo en un lote.
  - `categorizeMerchant`: entrada del diccionario + `edits.<id>.category` de cada referencia + quitar cada `items.<id>`, en un lote (una escritura por mes).
  - `setCategoryArchived(id, true, keys)`: `archived` + borrar `items.<key>` del diccionario en un lote.
  - Las escrituras por mes (`setFixed`, `addEntry`, `removeEntry`, `setRate`, `setCap`) crean el mes si no existe, con la herencia de las Restricciones globales, dentro de una transacción. `setRate` y `setCap` ponen su marca `…Inherited` en `false`. `setCap(month, null)` deja `cap: null, capInherited: false`.
  - Los ids nuevos se generan en el cliente (`crypto.randomUUID()`).
- Cambios de firma: `CategoriesApi.remove` pasa a `setArchived(id: string, archived: boolean): Promise<void>`, y `setExpenseCategory(expense: Expense, categoryId: string | null)`. `EntriesApi.remove(id)` pasa a `remove(entry: Entry)`. Se borran las interfaces `*Source` en la Tarea 16, no acá.
- `fakeBackend.ts`: `createFakeBackend(seed?: { config?: Partial<AppConfig>; months?: MonthData[]; uncategorized?: UncategorizedItem[] }): Backend & { reads: string[] }`. Guarda todo en memoria, registra cada lectura (`'config'` ×5, `'month:2026-10'`, `'uncategorized'`) y aplica la misma semántica.
- `firestoreBackend.ts`: `createFirestoreBackend(db: Firestore): Backend`. Lecturas con `getDoc`. Escrituras con `updateDoc`/`setDoc(…, {merge: true})`/`writeBatch`/`runTransaction` por ruta de campo, nunca reescribiendo un mapa entero.

- [ ] **Paso 1: tests que fallan.**
  - `fakeBackend.test.ts`: un test por regla de semántica de arriba, más `records one read per document`.
  - `test/rules.backend-firestore.test.ts` (emulador, contexto del hogar con las reglas nuevas):
    - el mismo set de casos contra `createFirestoreBackend`
    - `readConfig` sobre una base vacía devuelve listas vacías
    - `setExpenseCategory` sobre un mes que tiene la compra no cambia `purchases`
    - `addEntry` en un mes inexistente lo crea heredando de un mes anterior sembrado
- [ ] **Paso 2:** `npm --prefix web test -- src/data/fakeBackend.test.ts` y `npm run test:rules` → FALLAN.
- [ ] **Paso 3:** implementar los tres archivos y cambiar las dos firmas (las pantallas que llaman a `remove` se ajustan en sus tareas; hasta entonces, adaptar las llamadas para que compile).
- [ ] **Paso 4:** los dos comandos → PASAN; `npm --prefix web run build` → OK.
- [ ] **Paso 5:** commit `feat(web): Backend interface with fake and Firestore implementations`.

### Tarea 9: `DataStore` y hooks

**Archivos:**
- Crear: `web/src/data/dataStore.ts`, `web/src/data/DataProvider.tsx`
- Test: `web/src/data/dataStore.test.ts`

**Interfaces:**
- Consume: `Backend` (Tarea 8), conversiones (Tarea 6).
- Produce en `dataStore.ts`:
```ts
export type Load<T> = { status: 'loading' | 'ready' | 'error'; data: T | null; error: string | null }
export type StoreState = {
  config: Load<AppConfig>
  uncategorized: Load<UncategorizedItem[]>
  months: ReadonlyMap<MonthId, Load<MonthData | null>>   // null = el mes no existe
}
export class DataStore {
  constructor(backend: Backend)
  getState(): StoreState
  subscribe(listener: () => void): () => void
  loadConfig(): Promise<void>                 // una vez por sesión
  loadUncategorized(): Promise<void>          // una vez por sesión
  ensureMonths(ids: MonthId[] | 'all'): Promise<void>   // solo los no pedidos todavía; 'all' = config.months
  cardsApi: CardsApi; categoriesApi: CategoriesApi; merchantsApi: MerchantsApi
  fixedApi: FixedApi; ratesApi: RatesApi; capsApi: CapsApi
  entriesApi(kind: EntryKind): EntriesApi
  categorize(expense: Expense, categoryId: string | null): Promise<void>   // "Compras a categorizar"
}
```
- Cada mutación llama al `Backend` y, si sale bien, actualiza el estado en memoria: config, meses ya cargados y lista de sin categorizar. Nunca vuelve a leer. Si escribe en un mes que no estaba en `config.months`, lo agrega a la lista y borra su entrada del caché (si estaba como `null`), así la próxima vez que se pida se lee con lo heredado.
- `categoriesApi.setExpenseCategory(expense, null)` agrega a la lista solo si `expense.status !== 'rejected'`.
- `categoriesApi.setArchived(id, true)` calcula las claves del diccionario que apuntan a `id`.
- `categorize(expense, categoryId)`: con `categoryId` y una clave de comercio no vacía, usa `categorizeMerchant` con todas las entradas de la lista del mismo `merchantKey` (incluida la propia). Si no, hace lo mismo que `setExpenseCategory`.
- Produce en `DataProvider.tsx`: `DataProvider({ store, children })` y los hooks `useDataStore()`, `useConfig(): Load<AppConfig>`, `useUncategorized(): Load<UncategorizedItem[]>`, `useMonths(ids: MonthId[] | 'all' | null): Load<MonthData[]>` (con `useSyncExternalStore`; `useMonths` llama a `ensureMonths` en un efecto; `null` = todavía no se sabe qué meses pedir; devuelve solo los meses existentes, sin los `null`).

- [ ] **Paso 1: tests que fallan** en `dataStore.test.ts`, con `createFakeBackend`:
  - `ensureMonths reads each month once, even when asked twice or concurrently` (`reads` sin repetidos)
  - `ensureMonths('all') reads every month of config.months`
  - `a missing month is cached as null and not read again`
  - `setExpenseCategory updates the loaded month and the uncategorized list without reading`
  - `categorizing a purchase of a month that was never loaded works and the month later shows the category`
  - `categorize applies the category to every listed purchase of the same merchant`
  - `setArchived drops the dictionary entries of the category`
  - `writing to a month that does not exist adds it to config.months and the next ensureMonths reads it with the inherited values`
  - `a failed backend write leaves the state unchanged and rejects`
- [ ] **Paso 2:** `npm --prefix web test -- src/data/dataStore.test.ts` → FALLA.
- [ ] **Paso 3:** implementar `dataStore.ts` y `DataProvider.tsx`.
- [ ] **Paso 4:** el mismo comando → PASA.
- [ ] **Paso 5:** commit `feat(web): in-memory DataStore and hooks`.

---

## Etapa 5 — Pantallas

Patrón para todas las pestañas: un contenedor `…Tab.tsx` usa los hooks, calcula qué meses pedir, muestra esqueleto o error, y pasa datos simples (`Expense[]`, `CardsData`, `Rates`, `Caps`, …) a la pantalla actual. Las pantallas dejan de recibir `*Source` y no llaman hooks de datos. Mientras dura la etapa, `App` recibe **además** `createBackend: () => Backend` y conserva las fuentes viejas para las pestañas todavía no convertidas. La Tarea 16 las elimina.

Cada tarea de esta etapa termina con: `npm --prefix web test`, `npm --prefix web run build` y `npm --prefix web run lint` → OK, y commit.

### Tarea 10: `App` con `DataStore` e Inicio

**Archivos:**
- Modificar: `web/src/App.tsx`, `web/src/main.tsx`, `web/src/home/HomeScreen.tsx`, `web/src/cards/cardLogic.ts`, `web/src/strings.ts`
- Crear: `web/src/home/HomeTab.tsx`
- Test: `web/src/App.test.tsx`, `web/src/home/HomeScreen.test.tsx`, `web/src/cards/cardLogic.test.ts`

**Interfaces:**
- `App` agrega la prop `createBackend: () => Backend`. `Authorized` crea un `DataStore` una vez (`useState`) y envuelve las pestañas en `DataProvider`. Al montar llama a `loadConfig()` y `loadUncategorized()`. `changeCategory` y `categorize` pasan a usar `store.categoriesApi.setExpenseCategory` y `store.categorize`.
- `HomeScreen` recibe `{ expenses: Expense[]; cards: CardsData; fixed: FixedData; categories: Category[]; incomes: Entry[]; caps: Caps; rates: Rates; uncategorizedCount: number; newCards: DetectedCard[]; onCategoryChange: (expense: Expense, categoryId: string | null) => void; onNavigate }`. Ya no recibe fuentes. Las alertas usan `uncategorizedCount` y `newCards`.
- `findUnassignedCards(seen: SeenCard[], cards: Card[], accounts: Account[]): DetectedCard[]`: las vistas sin tarjeta guardada más las guardadas cuya cuenta no existe. Mismo orden que hoy.
- `HomeTab`: `useMonths(homeMonths(config.cards, config.months, today))`. Arma `expenses`, `rates`, `caps`, `fixed` e `incomes` con `expensesOf`/`ratesOf`/… sobre esos meses.
- `PurchasesTable`/`PeriodCard`: `onCategoryChange` recibe el `Expense` en vez del id (en todos los usos).

- [ ] **Paso 1: tests que fallan.**
  - `App.test.tsx`, con `createFakeBackend` sembrado con config, `2026-09`…`2026-11` y la fecha fijada en 2026-11-06:
    - `home reads config, uncategorized and only the months it needs` (`reads` = 5 de config + `uncategorized` + `month:2026-09/10/11`)
    - `switching to another tab and back to home reads nothing more`
    - `changing a category on home updates the screen without reading`
  - `cardLogic.test.ts`: `findUnassignedCards uses seen cards`
  - `HomeScreen.test.tsx`: ajustar a las props nuevas
- [ ] **Paso 2:** `npm --prefix web test` → FALLAN los nuevos.
- [ ] **Paso 3:** implementar. En `main.tsx`, `createBackend={() => createFirestoreBackend(db)}`.
- [ ] **Paso 4 y 5:** verificación y commit `feat(web): home reads month documents`.

### Tarea 11: Gastos

**Archivos:**
- Modificar: `web/src/expenses/MonthExpenses.tsx`, `web/src/expenses/statements.ts` (borrar `availableMonths`, que ya no se usa), `web/src/strings.ts`
- Crear: `web/src/expenses/ExpensesTab.tsx`
- Test: `web/src/expenses/MonthExpenses.test.tsx` (nuevo), `web/src/expenses/statements.test.ts`

**Interfaces:**
- `MonthExpenses` recibe `{ months: MonthId[] (de offeredMonths); month: MonthId; onMonthChange; expenses; cards; categories; caps: Caps; rates: Rates; loading: boolean; onCategoryChange }`. Muestra `strings.gastos.emptyMonth` cuando el grupo del mes elegido no tiene compras.
- `ExpensesTab` guarda el mes elegido (por defecto `defaultMonth(offered, today)`) y pide `groupMonths(config.cards, month, config.months)`.

- [ ] **Paso 1: tests que fallan:**
  - `choosing another month reads only the months not read yet`
  - `an offered month without purchases shows the empty state`
- [ ] **Pasos 2 a 5:** implementar, verificar y commit `feat(web): Gastos reads month documents`.

### Tarea 12: Tarjetas

**Archivos:**
- Modificar: `web/src/cards/CardsScreen.tsx`, `web/src/App.tsx` (`CardsTab`)
- Test: `web/src/cards/CardsScreen.test.tsx`

**Interfaces:**
- `CardsScreen` recibe `{ data: CardsData; seenCards: SeenCard[]; api: CardsApi }` (sin `expenses` ni `expensesStatus`) y usa `findUnassignedCards(seenCards, …)`. La pestaña no pide ningún mes.

- [ ] **Paso 1: test que falla:** `the cards tab reads no month`, y ajustar los tests existentes a las props nuevas.
- [ ] **Pasos 2 a 5:** implementar, verificar y commit `feat(web): Tarjetas uses config/cards`.

### Tarea 13: Categorías (lista de sin categorizar y archivar)

**Archivos:**
- Modificar: `web/src/categories/CategoriesScreen.tsx`, `web/src/categories/CategoryPicker.tsx`, `web/src/merchants/ToCategorize.tsx` (borrar `needsCategory`), `web/src/strings.ts`
- Test: `web/src/merchants/ToCategorize.test.tsx`, `web/src/categories/CategoriesScreen.test.tsx` (nuevo), `web/src/categories/CategoryPicker.test.tsx` (nuevo)

**Interfaces:**
- `ToCategorize` recibe `{ items: UncategorizedItem[]; categories; onCategorize: (expense: Expense, categoryId: string | null) => void }` y muestra `items.map(uncategorizedToExpense)`, de más nueva a más vieja.
- `CategoriesScreen` recibe `{ uncategorized: UncategorizedItem[]; categories; api; merchants; merchantsApi; onCategorize; initialOpen }`. El título usa la cantidad de la lista. El botón de borrar pasa a **Archivar** (`strings.categories.archive`, `archiveTitle`, `archiveText`). Las archivadas se listan al final, atenuadas, con **Reactivar** (`strings.categories.unarchive`), con el mismo patrón visual que los tipos de fijos desactivados.
- `CategoryPicker` ofrece solo las no archivadas, más la actual si está archivada. `CategoryTag` y `buildBreakdown` siguen recibiendo la lista completa, así las archivadas se ven con su nombre y color.
- La pestaña no pide ningún mes.

- [ ] **Paso 1: tests que fallan:**
  - `lists every uncategorized item, however old`
  - `archiving asks for confirmation and calls setArchived`
  - `an archived category can be reactivated`
  - `the picker hides archived categories except the current one`
  - `the categories tab reads no month`
- [ ] **Pasos 2 a 5:** implementar, verificar y commit `feat(web): Categorías uses the uncategorized list and archives categories`.

### Tarea 14: Presupuesto por mes

**Archivos:**
- Modificar: `web/src/budget/BudgetScreen.tsx`, `web/src/fixed/FixedScreen.tsx`, `web/src/money/MoneyScreen.tsx`, `web/src/money/EntrySection.tsx`, `web/src/home/CapsScreen.tsx`, `web/src/strings.ts`
- Crear: `web/src/budget/BudgetTab.tsx`
- Test: `web/src/fixed/FixedScreen.test.tsx`, `web/src/money/EntrySection.test.tsx`, `web/src/home/CapsScreen.test.tsx` (nuevo)

**Interfaces:**
- `FixedScreen` recibe `{ data: FixedData; api: FixedApi; isMonthLoaded: (month: MonthId) => boolean; onMonthChange: (month: MonthId) => void }`. Mientras el mes elegido no está cargado, la sección del mes muestra `ListSkeleton`. El contenedor pide ese mes.
- `MoneyScreen` recibe `{ incomes: Entry[]; savings: Entry[]; incomesApi; savingsApi }`. Como el contenido de la tarjeta se monta recién al abrirla, el contenedor pide `'all'` en ese momento (`MoneyCard` dentro de `BudgetTab`). `EntrySection` llama a `api.remove(entry)`.
- `CapsScreen` recibe `{ month: MonthId; onMonthChange; cap: { amount: number | null; inherited: boolean } | null (null = cargando); api: CapsApi }`. Muestra y edita el tope del mes elegido, con `strings.caps.inherited` cuando `inherited` es verdadero. Se borran la lista de topes definidos y la línea "en vigencia".
- La tarjeta de fijos pide el mes elegido; la de topes también.

- [ ] **Paso 1: tests que fallan:**
  - `fixed: moving to another month reads only that month`
  - `caps: shows the inherited note and saving clears it`
  - `money: opening the card reads all months once`
  - `removing an entry passes the entry`
- [ ] **Pasos 2 a 5:** implementar, verificar y commit `feat(web): Presupuesto edits month documents`.

### Tarea 15: Balance e Histórico

**Archivos:**
- Modificar: `web/src/balance/BalanceScreen.tsx`, `web/src/history/HistoryScreen.tsx`, `web/src/balance/balance.ts`, `web/src/strings.ts`
- Crear: `web/src/balance/BalanceTab.tsx`
- Test: `web/src/balance/balance.test.ts`, `web/src/balance/BalanceScreen.test.tsx` (nuevo)

**Interfaces:**
- `buildBalance` recibe además `rateInherited: boolean` y devuelve `Balance.rateInherited`. El resto del cálculo no cambia.
- `BalanceScreen` y `HistoryScreen` reciben `{ expenses; cards; fixed: FixedData; incomes: Entry[]; savings: Entry[]; rates: Rates; inheritedRates: Set<MonthId> }`, y `BalanceScreen` además `ratesApi`. `BalanceTab` pide `'all'`.
- Se muestra `strings.history.inheritedRate` donde hoy aparece `noRate`, cuando el tipo de cambio del mes es heredado y hay ingresos en dólares. En el bloque de ingresos del Balance, junto al editor del tipo de cambio, se muestra siempre que sea heredado.

- [ ] **Paso 1: tests que fallan:**
  - `buildBalance reports an inherited rate`
  - `the balance tab reads every month once`
  - `saving the rate clears the inherited note`
- [ ] **Pasos 2 a 5:** implementar, verificar y commit `feat(web): Balance and Histórico read month documents`.

### Tarea 16: Retirar la capa vieja

**Archivos:**
- Borrar: `web/src/expenses/expensesSource.ts`, `useExpenses.ts`, `useExpenses.test.tsx`; `web/src/cards/firestoreCards.ts`, `useCards.ts`, `useCards.test.tsx`; `web/src/categories/firestoreCategories.ts`, `useCategories.ts`; `web/src/merchants/firestoreMerchants.ts`, `useMerchants.ts`; `web/src/money/firestoreEntries.ts`, `useEntries.ts`; `web/src/fixed/firestoreFixed.ts`, `useFixed.ts`; `web/src/balance/firestoreRates.ts`, `useRates.ts`; `web/src/home/firestoreCaps.ts`, `useCaps.ts`
- Modificar: `web/src/App.tsx` (props: solo `authApi` y `createBackend`), `web/src/main.tsx`, las interfaces `*Source` de `cardsApi.ts`, `categoriesApi.ts`, `merchantsApi.ts`, `entries.ts`, `fixedApi.ts`, `ratesApi.ts` y `capsApi.ts` (borrarlas), `web/src/App.test.tsx`

- [ ] **Paso 1:** borrar y ajustar.
- [ ] **Paso 2:** `grep -rn "onSnapshot" web/src` → sin resultados.
- [ ] **Paso 3:** `npm --prefix web test`, `npm --prefix web run build`, `npm --prefix web run lint`, `npm test`, `npm run test:store` y `npm run test:rules` → todo OK.
- [ ] **Paso 4:** commit `refactor(web): remove listeners and per-collection sources`.

---

## Etapa 6 — Migración y corte

### Tarea 17: Script de migración, volcado y siembra

**Archivos:**
- Crear: `scripts/migrate-to-months.js`
- Modificar: `scripts/lib/dumpFormat.js` (`COLLECTIONS` agrega `months`, `config`, `meta`), `scripts/dump-prod.js`, `scripts/seed-emulator.js`, `package.json` (script `migrate`)

**Interfaces:**
- `node scripts/migrate-to-months.js`: con `FIRESTORE_EMULATOR_HOST` usa el emulador; si no, exige `GCP_PROJECT_ID`. Lee las 12 colecciones viejas, llama a `migrate` y escribe `months/*`, `config/*` y `meta/uncategorized` con `set` sin `merge` (re-ejecutable: el resultado es siempre el mismo). Escribe en lotes de hasta 400 documentos e imprime `counts`. No toca las colecciones viejas.
- `dump-prod.js` vuelca las viejas y las nuevas, así la Tarea 7 corre sobre producción migrada. `seed-emulator.js` siembra lo que traiga el volcado.

- [ ] **Paso 1:** `npm run dev:emulators` en otra terminal, después `npm run dev:seed`, después `FIRESTORE_EMULATOR_HOST=localhost:8080 npm run migrate` → imprime los conteos y coinciden con el volcado (2.099 compras el 4/11).
- [ ] **Paso 2:** correr `npm run migrate` otra vez → mismos documentos (comparar en la interfaz del emulador; `config/months.list` sin duplicados).
- [ ] **Paso 3:** `npm run dev:web`: la app abre sobre el emulador migrado; el Inicio, Gastos, Balance e Histórico muestran los mismos números que la versión de `main` sobre el volcado sin migrar.
- [ ] **Paso 4:** commit `feat(scripts): migrate to month documents and dump/seed the new collections`.

### Tarea 18: Runbook del corte

**Archivos:**
- Modificar: `RUNBOOK.md` (sección nueva "Corte a documentos por mes" y actualizar "Web app collections" y "Merchant dictionary" con la estructura nueva)

Contenido de la sección, en este orden (el despliegue lo hace el usuario):
1. Respaldo: `npm run dev:dump` (con las colecciones viejas).
2. Frenar la ingesta: `gcloud pubsub subscriptions modify-push-config gmail-notifications-push --push-endpoint=""` (los avisos quedan retenidos en la suscripción) y `gcloud scheduler jobs pause renew-watch-daily`.
3. `GCP_PROJECT_ID=<id> npm run migrate` y revisar que los conteos coincidan.
4. `npm run dev:dump` y `npm test -- test/parity.months.test.ts` → PASA sobre producción migrada.
5. `npm run web:deploy` (reglas y web nuevas).
6. `terraform apply` (función nueva; restaura el `push_endpoint`). Después `gcloud scheduler jobs resume renew-watch-daily`.
7. `reprocess.js --days <días desde el paso 2 + 1>`.
8. Verificación manual: abrir la app y comprobar en la consola de Firebase que una apertura del Inicio cuesta ≈ 10 lecturas; llega una compra nueva → aparece al recargar; categorizar una compra; cargar un ingreso de un mes futuro.
9. Las colecciones viejas quedan como respaldo. Se borran a mano después de unos días sin problemas.
10. Vuelta atrás si algo falla antes del paso 7: volver a desplegar `main` (web + reglas + `terraform apply`). Las colecciones viejas siguen intactas.

- [ ] **Paso 1:** escribir la sección.
- [ ] **Paso 2:** commit `docs: cutover runbook for month documents`.

---

## Autorrevisión

- **Cobertura del spec:**
  - estructura y creación de meses: Tareas 2, 3 y 8
  - configuración y `seenCards`: Tareas 2, 3, 8, 10 y 12
  - lista de sin categorizar: Tareas 2, 3, 8, 9 y 13
  - lectura por pantalla y caché: Tareas 6, 9 y 10 a 15
  - reglas: Tarea 5
  - archivado: Tareas 8, 9 y 13
  - heredados y avisos: Tareas 2, 3, 14 y 15
  - selector de Gastos: Tareas 6 y 11
  - costo de la ingesta: Tarea 3
  - migración, volcado y siembra: Tareas 2 y 17
  - paridad: Tarea 7
  - presupuesto de lecturas: Tareas 9 a 15
  - corte: Tarea 18
  - `note` queda preparado en el contrato y en las reglas (Tarea 5), sin interfaz, como pide el spec.
- **Diferencia con el spec:** el presupuesto de lecturas del Inicio es ≈ 10 (5 de configuración, la lista y 3 o 4 meses), no ≈ 6–8. Se debe a separar la configuración en 5 documentos, como deja abierto el spec. Sigue siendo ~230 veces menos que hoy.
