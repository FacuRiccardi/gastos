# Cuotas: convertir una compra ya cargada en compra en cuotas

Fecha: 2026-11-04

## Intención

Hoy el parser de emails no sabe qué compras son en cuotas, y las compras en cuotas se cargan como una compra común. El usuario quiere poder tomar una compra común ya cargada y convertirla en una compra en cuotas, indicando cuántas cuotas hay en total y en qué cuota está. Las cuotas que faltan se generan como compras comunes en los resúmenes (períodos) siguientes. Así los resúmenes reflejan los compromisos de pago reales, incluso retroactivamente.

El parser de emails **no cambia** en este trabajo.

## Objetivos

- Convertir una compra existente en una compra en cuotas desde la app web.
- Generar las cuotas que faltan como compras comunes, de modo que los totales por período, el cap alert y los gráficos sigan calculándose como hoy, sin lógica especial.
- Efecto retroactivo: si ya hay cortes cargados posteriores a la compra, las cuotas correspondientes se crean enseguida en esos períodos.
- Cuotas pendientes: las que todavía no tienen período se crean automáticamente cuando se cargan nuevos cortes.

## No objetivos

- No se modifica el parser de emails ni se detectan cuotas automáticamente.
- No se crean las cuotas anteriores a la actual (se asume que ya existen en los datos cargados).
- No se edita ni se deshace un plan de cuotas: la conversión es definitiva.
- No se proyectan cuotas futuras sin corte cargado (no afectan ningún cálculo actual).
- No se modifica el cálculo de períodos ni del cap alert.

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que las cuotas futuras sin período cuenten en el gasto actual o en el cap alert.
- Convertir dos veces la misma compra, o generar cuotas duplicadas al cargar cortes repetidamente.
- Convertir una compra sin categoría.

## Contexto técnico relevante (del código actual)

- Una compra cae en el período cuyo corte la contiene según `purchaseDate` (ver `src/periodSpend.js`, `web/src/expenses/statements.ts`). Los períodos se definen por documentos `cycles` (`accountId`, `closingDate`, `dueDate`) que la persona carga a mano desde la sección Tarjetas; se cargan por lote de texto (`parseCyclesText` en `web/src/cards/cardLogic.ts`).
- Un período pertenece a una cuenta (`accounts`); cada tarjeta (`cards`) apunta a una cuenta. Las cuotas se asignan a los cortes de la cuenta de la tarjeta de la compra.
- Las compras (`expenses`) las crea solo el backend con Admin SDK. En `firestore.rules` las compras tienen `create: if false` y desde el navegador solo se puede cambiar `categoryId`.
- Una compra tiene: `purchaseDate`, `receivedAt`, `merchant`, `amount`, `currency`, `cardLast4`, `cardType`, `cardHolder`, `status`, `categoryId`.

## Decisiones tomadas por el usuario

- El monto que tiene la compra convertida es **el valor de una cuota**. Cada cuota generada vale lo mismo.
- La compra original pasa a ser la cuota actual indicada (por ejemplo, la 2 de 6). Se generan solo las cuotas siguientes (3, 4, 5 y 6): son `total - actual` compras nuevas.
- Las cuotas generadas son compras comunes, por lo que afectan los resúmenes como cualquier otra compra. Las cuotas futuras sin período no cuentan para nada hasta que exista su período.
- Al cargar nuevos cortes, las cuotas pendientes se aplican a los períodos nuevos.
- Una compra ya convertida a cuotas (original o generada) no puede volver a convertirse.
- La conversión es definitiva (sin deshacer). Las compras no se modifican después.
- Antes de convertir hay un paso de confirmación que muestra la compra (comerciante, monto, categoría) y cuántas cuotas nuevas se van a generar.
- Si la compra no tiene categoría, se puede abrir y completar el formulario, pero al enviarlo falla con un mensaje claro: la compra debe tener categoría para poder pasarse a cuotas.

## Comportamiento

**Formulario.** Se abre desde una compra de la lista. Campos: cuotas totales y cuota actual. Validaciones: enteros, total ≥ 2, 1 ≤ actual ≤ total. Si actual = total no hay cuotas nuevas: en ese caso no tiene sentido convertir (se rechaza con un mensaje).

**Confirmación.** Muestra comerciante, monto, categoría y la cantidad de cuotas nuevas (`total - actual`). Al confirmar se crea el plan y las cuotas que ya tengan período.

**Asignación a períodos.** La cuota actual + k (k = 1, 2, ...) se asigna al k-ésimo corte de la cuenta posterior al período de la compra original. Si ese corte existe, se crea la compra de esa cuota con una fecha dentro del período. Si no existe, queda pendiente.

**Cargar cortes.** Después de guardar cortes nuevos de una cuenta, se revisan los planes de cuotas con cuotas pendientes de las tarjetas de esa cuenta y se crean las que ya tienen período. El proceso es idempotente: nunca se crea dos veces la misma cuota de un plan.

**Cuotas generadas.** Copian comerciante, monto, moneda, tarjeta, titular, estado y categoría de la compra original, y llevan una marca que identifica el plan y el número de cuota ("cuota 3/6") para mostrarlo en la lista.

## Decisiones tomadas por mí (a validar)

- La fecha de cada cuota generada es el primer día de su período (el día siguiente al corte anterior).
- La creación de las cuotas la hace la app web (en la conversión y al guardar cortes), con una regla de Firestore nueva que permite crear compras solo si llevan la marca de cuota y referencian un plan válido. La alternativa (un backend que reaccione a los cortes) queda descartada por ahora por requerir más infraestructura.
- Las notificaciones de compra nueva (y la futura de "sin categoría") no deben dispararse por cuotas generadas.
- El plan se guarda en una colección nueva (por ejemplo `installmentPlans`) con: compra original, cuenta, total, cuota actual, y cuáles cuotas ya se crearon.

## Lo que queda a criterio de quien construya

- Nombres exactos de colecciones, campos y de la marca de cuota.
- Cómo se muestran visualmente la insignia "cuota N/M" y el botón de convertir.
- Textos de los mensajes, siguiendo el sistema de strings existente.
- Estrategia de tests (reglas de Firestore, lógica de asignación y UI).
