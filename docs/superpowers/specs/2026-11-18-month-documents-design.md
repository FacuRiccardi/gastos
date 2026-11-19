# Datos por mes: nueva estructura en Firestore y carga por demanda

Fecha: 2026-11-18

Reemplaza a `2026-11-06-lazy-loading-inicio-design.md` y a su plan `2026-11-06-lazy-loading-inicio.md` (nunca implementados). Aquel diseño mantenía la colección `expenses` y usaba consultas de agregación; este cambia la estructura de los datos.

## Intención

La app lee demasiado de Firestore. Al abrirla escucha en tiempo real la colección `expenses` completa (2.099 documentos el 4/11, ~160 nuevos por mes) más las 12 colecciones chicas (~205 documentos): unas **2.300 lecturas por apertura**, y cada pestaña vuelve a suscribirse a varias colecciones al montarse. La capa gratuita de Firestore es de 50.000 lecturas por día y se supera rápido.

El usuario quiere dos cosas:

1. **Que las lecturas sean por demanda:** no se lee nada hasta que se necesita para lo que el usuario está viendo.
2. **Que la información se guarde ya organizada al escribirla**, para que leer no dependa de juntar datos de 6 o 7 colecciones distintas.

Es una app personal de dos personas: **no necesita tiempo real.** Para ver datos nuevos (por ejemplo una compra recién llegada) se recarga la página.

## Objetivos

- **Todo lo que pertenece a un mes vive en un documento del mes** (`months/YYYY-MM`): las compras de ese mes, lo que el usuario les agrega (categoría, nota), ingresos, ahorros, gastos fijos, tipo de cambio y tope.
- **La configuración vive en pocos documentos** (cuentas, tarjetas, cierres, categorías, tipos de gastos fijos, diccionario de comercios, tarjetas vistas, índice de meses).
- **Las compras sin categorizar tienen su propio documento** (`meta/uncategorized`) con lo necesario para mostrarlas, sin abrir meses.
- **Ningún `onSnapshot` en la web.** Lecturas únicas; lo leído se conserva en memoria durante la vida de la página.
- **Se leen solo los meses necesarios** para lo que se muestra; un mes ya leído no se vuelve a leer en la sesión.
- **Los números que muestra la app son los mismos que hoy**, salvo las diferencias aceptadas (ver abajo).
- Presupuesto de lecturas orientativo:

| Acción | Hoy | Objetivo |
|---|---|---|
| Abrir la app en Inicio (con "Más datos" y movimientos) | ~2.300 | ≈ 6–8 (config + 3 meses + sin categorizar) |
| Cambiar de pestaña y volver | varias | 0 |
| Gastos: elegir otro mes | 0 | ≤ 2 (solo meses no leídos) |
| Categorías | — | 1 (sin categorizar) + config ya leída |
| Balance / Histórico | — | un documento por mes con datos (≈ 15 hoy, +12 por año) |

## No objetivos

- No se cambia de base de datos ni se mueve el cálculo al backend (salvo lo que la ingesta escribe al guardar una compra).
- No se agrega librería de estado ni de caché, ni persistencia en el dispositivo (IndexedDB, localStorage).
- No se cambia el diseño visual de las pantallas, salvo lo indicado en "Cambios de comportamiento".
- No se implementan las cuotas ni la descripción libre: solo se deja la estructura lista para ellas (ver "Preparado para el futuro").
- No se mantiene compatibilidad con la estructura vieja: el corte es de una vez.

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que alguna pantalla o el arranque lea **todos** los meses sin que el usuario entre a una vista que los necesita (Balance/Histórico).
- Que un total, subtotal, porcentaje o balance cambie respecto de hoy, fuera de las diferencias aceptadas.
- Que la ingesta duplique una compra o pise una existente (reintentos de Pub/Sub, `reprocess.js`).
- Que una compra quede guardada en su mes pero no en "sin categorizar" (o al revés) cuando corresponde estar en ambos.
- Que desde la web se pueda modificar un dato que vino del banco (fecha, comercio, monto, moneda, tarjeta, titular, estado).
- Que después de un guardado hecho desde la app la pantalla siga mostrando el dato viejo.
- Que se pierda alguna compra, ingreso, ahorro, fijo, cierre o categoría en la migración.

## Por qué por mes y no por período

(Decisión discutida con el usuario.) El período de una compra depende de datos cargados a mano y a veces tarde: las fechas de cierre de la cuenta y la cuenta a la que está asignada la tarjeta. Cuando la compra llega, su período a menudo no existe todavía, y agregar o corregir un cierre mueve compras entre períodos. El mes calendario de la compra (en hora de Buenos Aires) se conoce al llegar el mail y no cambia nunca. Un período cruza como mucho dos meses en el caso normal; leer 2 documentos en vez de 1 es un costo despreciable a cambio de no reescribir datos nunca.

## Estructura de datos

### `months/{YYYY-MM}`

Un documento por mes calendario (Buenos Aires).

```
purchases: { <purchaseId>: {
    purchaseDate: Timestamp,   // medianoche de Buenos Aires, como hoy
    receivedAt: Timestamp,
    merchant, amount, currency, cardLast4, cardType, cardHolder, status
} }                            // solo la ingesta (Admin SDK)
edits:     { <purchaseId>: { category?: string, note?: string } }   // la web
incomes:   { <entryId>: { amount, currency, date, owner } }
savings:   { <entryId>: { amount, currency, date } }
fixed:     { <typeId>: amount }
rate:      number | null       // pesos por dólar del mes
rateInherited: boolean         // copiado del mes anterior y no confirmado
cap:       number | null       // tope de gasto en pesos
capInherited: boolean
```

- `purchaseId` es el id del mensaje de Gmail, como hoy.
- Las compras son un **mapa**, no un arreglo: cada campo se actualiza por ruta (`edits.<id>.category`) con una escritura y sin leer antes.
- La categoría que asigna la ingesta (por el diccionario) también va en `edits.<id>.category`.
- Un ingreso o ahorro pertenece al mes de su `date`.
- Tamaño: el mes más grande del volcado (octubre 2026, 226 compras) pesa ~78 KB en JSON. El límite es 1 MB.

**Creación de un mes.** Un mes se crea la primera vez que alguien escribe en él: la ingesta (primera compra del mes) o la web (por ejemplo, un ingreso cargado por adelantado). Al crearlo, dentro de la misma transacción, se copian `rate` y `cap` del **mes existente más reciente anterior a él** y se marcan como heredados (`rateInherited`/`capInherited: true`). Si no hay mes anterior, quedan en `null`. Cuando el usuario guarda un valor desde la web, la marca pasa a `false`. **Cada mes queda independiente una vez creado:** cambiar el tope de octubre no cambia el de noviembre (decisión del usuario).

**El valor heredado es el valor del mes** (el usuario: "se setea el valor del mes anterior, y posteriormente el usuario lo puede modificar"). Todas las pantallas lo usan igual que uno cargado a mano, también Balance e Histórico; la marca solo sirve para avisar "heredado, sin confirmar". Con esto desaparecen las dos lógicas de hoy (`rateFor`/`capFor` con búsqueda hacia atrás en Inicio y Gastos; `rates[month]` exacto en Balance): cada mes tiene su valor o `null`.

**Mes que todavía no existe.** Si una pantalla necesita el tipo de cambio o el tope de un mes sin documento (por ejemplo, justo después de un cierre el grupo del Inicio pasa a ser diciembre y diciembre todavía no tiene compras), usa lo que ese mes heredaría al crearse: los valores del mes existente más reciente anterior a él (que casi siempre ya está en memoria; si no, se lee). No se crea el mes solo por leerlo (decisión mía).

### Configuración

Pocos documentos, leídos una vez por sesión. La agrupación exacta queda para el constructor; esta es la propuesta:

| Documento | Contenido |
|---|---|
| `config/cards` | `accounts` (id → nombre, titular), `cards` (`last4_type` → titular, cuenta), `cycles` (id → cuenta, cierre, vencimiento), `seenCards` (`last4_type` → titular, última fecha vista; **solo la ingesta**) |
| `config/categories` | id → nombre, color, `archived` |
| `config/fixedTypes` | id → nombre, `disabled` |
| `config/merchants` | clave de comercio → comercio, categoría (el diccionario) |
| `config/months` | lista de los meses existentes (para el Histórico, el selector de Gastos y "el mes anterior") |

### `meta/uncategorized`

```
items: { <purchaseId>: { month, merchant, amount, currency, purchaseDate, cardLast4, cardType, cardHolder } }
```

Contiene las compras **aprobadas** sin categoría, de cualquier antigüedad, con lo necesario para mostrar la fila y para encontrar las del mismo comercio.

- La ingesta agrega la compra cuando el diccionario no le da categoría, **en la misma transacción** que la guarda en su mes.
- La web, al categorizar, escribe `edits.<id>.category` en el mes y quita la entrada de `items` **en el mismo lote atómico**. Al quitarle la categoría a una compra aprobada, la vuelve a agregar.

## Escritura

### Ingesta (`src/store.js`, `src/sync.js`)

Por cada compra nueva:

1. Lee `config/merchants` (fuera de la transacción) para obtener la categoría del comercio. **No lee las categorías:** el diccionario nunca apunta a una categoría archivada (ver "Cambios de comportamiento").
2. En una transacción, lee `months/{mes}`; si `purchases.<id>` ya existe, termina sin escribir. Esta lectura reemplaza al `create()` de hoy: es lo que evita que un reintento de Pub/Sub o `reprocess.js` vuelva a mandar a "sin categorizar" una compra que el usuario ya categorizó.
3. Si el mes no existe: lee `config/months`, lee el mes anterior más reciente, crea el mes copiando `rate`/`cap` como heredados y agrega el mes a `config/months`.
4. Escribe `purchases.<id>` y, si el diccionario dio categoría, `edits.<id>.category`.
5. Si no hay categoría y la compra está aprobada: agrega `items.<id>` a `meta/uncategorized` (escritura por ruta de campo, sin leer el documento).
6. Si ninguna compra del mes leído tiene esa tarjeta (`last4_type`), es la primera de la tarjeta en el mes: escribe `config/cards.seenCards.<tarjeta>` (titular y fecha, sin leer el documento). Así se escribe ~1 vez por tarjeta y por mes, no en cada compra.

Todas las escrituras de los pasos 3 a 6 van en la misma transacción. `sumByRange` no se usa en producción y se elimina.

**Costo por compra** (sin contar `state/sync`, que no cambia: 2 lecturas y 1 escritura por aviso de Gmail):

| Caso | Lecturas | Escrituras |
|---|---|---|
| Hoy | 1 (diccionario) | 1 (la compra) |
| Compra común | 2 (diccionario + mes) | 1 (el mes) |
| Comercio sin categoría | 2 | 2 (+ `meta/uncategorized`) |
| Primera compra de una tarjeta en el mes (~5 por mes) | 2 | +1 (`seenCards`) |
| Primera compra del mes (1 por mes) | +2 (`config/months` + mes anterior) | +1 (`config/months`) |

**Por qué no compras individuales con un campo `month`** (alternativa discutida con el usuario): ahorraría la lectura del mes al escribir (~160 lecturas por mes), pero Firestore cobra por documento leído, así que abrir el Inicio volvería a costar ~500 lecturas y Balance/Histórico ~2.100. Cada compra se escribe una vez y se lee muchas: conviene pagar al escribir. Guardar ambas cosas (individuales + copia por mes) duplica escrituras y agrega riesgo de que difieran.

### Web

- Toda escritura es una actualización por ruta de campo (`updateDoc` con `'edits.<id>.category'`, `'incomes.<id>'`, `'fixed.<typeId>'`, `deleteField()` para borrar) o un lote cuando toca varios documentos.
- Escribir en un mes que no existe pasa por la misma lógica de creación que la ingesta (transacción; copia de `rate`/`cap` heredados; alta en `config/months`). Esa lógica se escribe una vez por lado (Node y web) y se prueba igual en ambos.
- **Categorizar un comercio** (desde "Compras a categorizar"): guarda la entrada del diccionario y, usando `meta/uncategorized` (que ya trae el comercio), categoriza las demás pendientes del mismo comercio. Un lote: una escritura por mes afectado + `meta/uncategorized` + `config/merchants`.
- Mover un ingreso o ahorro a una fecha de otro mes es borrar en un mes y crear en el otro, en un lote. (Hoy la app solo crea y borra.)
- Después de cada guardado propio, se actualiza la copia en memoria; no se vuelve a leer.

## Lectura

- **Al entrar:** los documentos de `config/*` y `meta/uncategorized`.
- **Inicio:** con los cierres se calcula el período actual de cada cuenta y el período del mes anterior (para la comparación); se leen los meses que esos rangos tocan (hoy, normalmente 3). Las alertas de gastos fijos e ingresos faltantes usan el mes actual; la de compras sin categorizar usa `meta/uncategorized`; la de tarjetas nuevas usa `config/cards` (`seenCards` sin tarjeta guardada, más tarjetas cuya cuenta no existe).
- **Gastos:** el selector ofrece los meses que hoy ofrece (meses de cierre cuyo período tiene compras). Para no leer todo el historial para armar la lista, se ofrecen los meses de cierre cuyo período **toca al menos un mes existente** (`config/months`), más el mes del grupo actual del Inicio aunque su cierre caiga en un mes que todavía no existe (decisión mía: así el período en curso nunca desaparece de Gastos). Un mes elegido que resulte sin compras muestra el estado vacío. Al elegir un mes se leen solo los meses que su período toca y no estén en memoria.
- **Tarjetas:** solo `config/cards` (y `seenCards` para detectar tarjetas nuevas).
- **Categorías:** `config/categories`, `config/merchants`, `meta/uncategorized`.
- **Presupuesto:** fijos, ingresos, ahorros y tope se muestran y editan **por mes**; se lee el mes elegido.
- **Balance / Histórico:** leen todos los meses de `config/months` (el acumulado de ahorros y la tabla por mes los necesitan).
- **Caché:** un mapa en memoria `mes → documento`, a nivel de la app (encima de las pestañas), con estado de React. Cambiar de pestaña, enfocar la ventana o reconectarse no vuelve a leer.

**Reutilización del cálculo.** `statements.ts`, `homePeriods.ts`, `categoryBreakdown.ts`, `balance.ts` y `rateFor`/`capFor` reciben listas en memoria. Se alimentan con las compras de los meses leídos (unidas con sus `edits`) y con los datos por mes, con los cambios mínimos para que sigan dando los mismos números. Las reglas de cálculo de hoy se conservan: período `(cierre anterior, cierre]`, solo tarjetas de crédito registradas, solo compras aprobadas en los montos, dólares al tipo de cambio del mes del grupo, etc.

**Rangos que requieren más meses.** Un período abierto va desde el día siguiente al último cierre hasta hoy. Si falta un cierre, el período toca 3 meses o más y se leen todos. Una cuenta **sin ningún cierre** toma todo el historial (como hoy) y obliga a leer todos los meses: se acepta, porque es un estado transitorio de una cuenta recién creada.

## Reglas de seguridad

Solo el hogar (`isHousehold()`, sin cambios) lee y escribe. Con datos en mapas las reglas no pueden validar cada entrada como hoy; la validación de valores pasa a la app. Lo que las reglas **sí** garantizan:

- `months/{mes}`: la web puede crear el documento solo con `purchases` vacío, y actualizar cualquier campo **salvo `purchases`**. El id tiene formato `YYYY-MM`.
- `config/cards`: la web no toca `seenCards`.
- `meta/uncategorized` y los demás `config/*`: el hogar puede escribir; formato de claves de primer nivel validado (`hasOnly`).
- Nada se borra desde la web a nivel documento (los meses y la configuración no se eliminan).
- Todo lo demás, denegado.

## Cambios de comportamiento (aceptados)

- **Sin tiempo real.** Compras nuevas o cambios desde otro dispositivo se ven al recargar.
- **Categorías archivadas en vez de borradas** (decisión del usuario). "Borrar" una categoría la archiva: deja de ofrecerse para elegir, pero las compras que la tenían la conservan y siguen mostrándose con su nombre y color (también en "Más datos"). Se puede reactivar (decisión mía, como los tipos de fijos). **Hoy** una compra con categoría borrada pasa a "sin categoría" y vuelve a la lista a categorizar; **ahora** no.
- **Archivar una categoría quita del diccionario los comercios que apuntan a ella**, en el mismo lote que la archiva. Así las compras nuevas de esos comercios entran como sin categorizar (coherente con "deja de aparecer para las nuevas compras") y la ingesta no necesita leer las categorías. Reactivar la categoría no restaura esas entradas del diccionario: se vuelven a crear al categorizar (decisión mía).
- **Tipo de cambio y tope heredados por copia** al crear el mes, independientes después (decisión del usuario). El aviso "falta el tipo de cambio" pasa a ser "tipo de cambio heredado, sin confirmar" cuando `rateInherited` es verdadero (decisión mía).
- **Tarjetas nuevas** se detectan con `seenCards` (lo que la ingesta vio) en vez de recorrer las compras. Equivale a hoy para las compras que entren después de la migración; la migración llena `seenCards` con todas las tarjetas del historial.

## Preparado para el futuro

- **Descripción libre de una compra:** `edits.<id>.note`. Una escritura, sin leer. Con 200 caracteres en cada una de ~160 compras son ~32 KB por mes.
- **Cuotas** (`2026-11-04-installments-design.md`): las cuotas generadas por la web irían en un mapa propio del mes (por ejemplo `installments`), escribible por la web, para no abrir `purchases`. Ese spec deberá revisarse contra esta estructura; no se implementa aquí.
- **Entorno demo** (`2026-11-06-demo-environment-design.md`): su carga de datos de ejemplo debe generarse en la estructura nueva.

## Migración y despliegue

Corte de una vez, con la app y la ingesta detenidas un rato (decisión del usuario).

1. Desplegar las reglas nuevas **no** antes del corte; hacer un volcado de producción (`scripts/dump-prod.js`) como respaldo.
2. Detener la ingesta (por ejemplo, deshabilitar la suscripción de Pub/Sub o el endpoint; Gmail sigue etiquetando).
3. Correr un script de migración (nuevo, en `scripts/`) que lee las colecciones viejas y escribe `months/*`, `config/*` y `meta/uncategorized`. Debe poder correrse en el emulador sobre `emulator-data/` y luego en producción, y ser re-ejecutable sin duplicar. Crea un documento por cada mes con compras, ingresos, ahorros, fijos, tipo de cambio o tope, y **llena el tipo de cambio y el tope de los meses que no tienen uno propio con el valor que hoy les aplica la app**, marcado como heredado (decisión mía, para que ningún número cambie):
   - tipo de cambio: el último anterior; si no hay anterior, el último cargado (lo que hace hoy `rateFor`). En el volcado del 4/11 eso afecta a 2025-09/10/11 y 2026-07, ninguno con ingresos en dólares;
   - tope: el último anterior; si no hay anterior, `null` (lo que hace hoy `capFor`).
4. Correr la verificación de paridad (abajo) contra producción migrada.
5. Desplegar ingesta, reglas y web nuevas.
6. Reactivar la ingesta y correr `reprocess.js` con una ventana que cubra el corte, para cargar los mails llegados mientras estaba detenida.
7. Las colecciones viejas se conservan un tiempo como respaldo (sin uso) y se borran después, a mano.

`scripts/seed-emulator.js` y `scripts/dump-prod.js` se adaptan a la estructura nueva.

## Verificación

- **Paridad:** sobre el volcado de producción, el cálculo nuevo (meses + configuración) y el actual (colecciones viejas) deben dar lo mismo para: totales por cuenta y período (todos los períodos), subtotales y conteos por tarjeta, grupos del Inicio y comparación con el mes anterior, desgloses por categoría de cada mes, y el balance de cada mes del Histórico. En el volcado del 4/11 no hay compras con categorías borradas, así que no debería aparecer diferencia por ese cambio. Tampoco por el tipo de cambio heredado en Balance: todos los meses con ingresos en dólares tienen tipo de cambio propio.
- **Conteo de documentos:** la migración informa cuántas compras, ingresos, ahorros, fijos, cierres, etc. leyó y escribió; deben coincidir.
- **Presupuesto de lecturas:** un test cuenta las lecturas que dispara abrir cada pestaña con fuentes falsas, según la tabla de objetivos.
- **Ingesta:** tests (emulador) de idempotencia (incluido que reprocesar una compra ya categorizada no la devuelve a "sin categorizar"), creación de mes con herencia de `rate`/`cap`, alta en `meta/uncategorized`, `seenCards` escrito solo en la primera compra de la tarjeta en el mes, compras con fecha en un mes viejo (backfill), y que una compra común lee 2 documentos y escribe 1.
- **Archivar una categoría:** quita del diccionario sus comercios en el mismo lote.
- **Reglas:** tests de que la web no puede tocar `purchases` ni `seenCards`, y sí `edits`, ingresos, ahorros, fijos, `rate` y `cap`.

## Lo que queda para quien construye

- Forma de las fuentes, hooks y caché en memoria; cómo se invalidan o actualizan tras un guardado.
- Agrupación exacta de los documentos de configuración.
- Estructura de archivos, orden de los commits y cómo se comparte la lógica de "crear mes" entre Node y la web.
- Cómo se detiene y reactiva la ingesta durante el corte.
- Cómo se adaptan las pantallas de Presupuesto a editar por mes.
