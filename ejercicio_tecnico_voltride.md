# Ejercicio técnico — VoltRide API

> API de gestión de flota de monopatines eléctricos.
> Este documento describe **qué** construir y **qué conceptos aplicar** — no cómo hacerlo.
> Las decisiones de implementación son tuyas.

---

## Contexto del negocio

**VoltRide** opera una flota de monopatines eléctricos en Buenos Aires. Los usuarios alquilan monopatines desde una app. El equipo de operaciones monitorea la flota y resuelve incidentes. Cada monopatín envía datos de batería y ubicación cada 30 segundos.

**Tres actores:**
- **Usuario final** — alquila y devuelve monopatines.
- **Operador** — monitorea la flota y gestiona el estado de los vehículos.
- **Sistema de telemetría** — envía datos de batería y ubicación desde cada monopatín.

---

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Fastify |
| Base de datos | PostgreSQL |
| Cache | Redis |
| Logging | Pino |
| Métricas | prom-client (Prometheus) |
| Testing | Vitest |
| Infraestructura local | Docker Compose |

---

## Requerimientos funcionales

1. Alta, baja y consulta de monopatines
2. Inicio y fin de alquiler con validaciones de negocio
3. Recepción de telemetría (batería + ubicación) desde los vehículos
4. Búsqueda de monopatines disponibles cerca de una ubicación geográfica
5. Health check con verificación real de dependencias
6. Endpoint de métricas en formato Prometheus

No hace falta autenticación real — usá un header `X-User-Id` para identificar al usuario.

---

## Estructura de carpetas esperada

Tenés que llegar a una estructura similar a esta. El nombre de las carpetas ya te dice dónde vive cada tipo de código. Antes de escribir una línea, pensá en qué capa pertenece cada cosa.

```
voltride-api/
├── src/
│   ├── domain/          # Entidades, value objects, interfaces, errores de dominio
│   ├── application/     # Casos de uso
│   ├── infrastructure/  # Implementaciones concretas (DB, cache, logger, métricas)
│   └── http/            # Rutas, middlewares, server
├── tests/
│   ├── unit/
│   └── integration/
└── docker-compose.yml
```

La regla más importante de esta estructura: **las dependencias solo apuntan hacia adentro**. `domain/` no conoce nada de `infrastructure/`. `application/` no conoce nada de `http/`. Si en algún momento necesitás importar algo de una capa exterior desde una capa interior, es una señal de que algo está mal diseñado.

---

---

# Módulo 1 — Diseño de software

**Conceptos a aplicar:** SOLID · Clean Architecture · Domain-Driven Design · Design Patterns · Separation of Concerns

Este es el módulo más importante. Todo lo demás (observabilidad, cache, rate limiting) se construye sobre esta base. Si el diseño es frágil, agregar las capas de performance y observabilidad va a ser doloroso.

---

## 1.1 — Domain-Driven Design

DDD es una forma de organizar el código alrededor del **lenguaje del negocio**, no alrededor de la tecnología. Antes de escribir código, tenés que modelar el dominio.

### Ubiquitous Language

Definí el glosario del dominio. Estos términos tienen que aparecer igual en el código, en los tests, y en las conversaciones con el equipo. No "vehicle" si el negocio dice "scooter". No "booking" si el negocio dice "rental".

Términos del dominio de VoltRide que tenés que modelar:

| Término | Descripción |
|---|---|
| **Scooter** | Un vehículo de la flota. Tiene identidad propia que persiste a lo largo del tiempo. |
| **Rental** | Un alquiler activo o histórico. Tiene un inicio, un fin, y pertenece a un usuario y un scooter. |
| **Telemetry** | Una lectura de batería y ubicación enviada por un scooter en un momento dado. |
| **ScooterStatus** | El estado actual de un scooter: `available`, `in_use`, `low_battery`, `maintenance`. |
| **Location** | Una coordenada geográfica (lat/lng). No es solo un par de números — tiene reglas de validación. |
| **BatteryLevel** | El nivel de batería expresado en porcentaje (0-100). Tiene un umbral de "batería baja". |

### Entities vs Value Objects

En DDD, no todo objeto es igual:

- Una **Entity** tiene identidad — dos scooters con el mismo número de serie pero distinto `id` son distintos. Su estado cambia a lo largo del tiempo.
- Un **Value Object** no tiene identidad — dos `Location` con la misma lat/lng son lo mismo. Son inmutables.

**Tu tarea:** Identificar cuáles de los términos del glosario son Entities y cuáles son Value Objects. Justificá tu decisión. Luego implementalos.

Preguntas que te ayudan a decidir:
- ¿Este objeto tiene un ciclo de vida que me importa rastrear?
- ¿Dos instancias con los mismos datos son la misma cosa?
- ¿Este objeto puede cambiar con el tiempo manteniendo su identidad?

### Aggregates y Aggregate Roots

Un **Aggregate** es un grupo de objetos que forman una unidad de consistencia. Solo se puede acceder al interior del aggregate a través de su **Aggregate Root**.

Identificá los aggregates del dominio. Algunas pistas:
- ¿Puede existir un `Rental` sin un `Scooter`?
- Si querés actualizar la ubicación de un scooter, ¿a quién le preguntás?
- ¿Quién es responsable de decidir si un scooter puede ser alquilado?

**Regla clave:** Los repositorios solo se crean para Aggregate Roots, no para cada entidad.

### Domain Events (opcional, pero recomendado)

Cuando algo importante sucede en el dominio, podés modelarlo como un **Domain Event**: un hecho que ocurrió en el pasado.

Ejemplos de eventos relevantes en VoltRide:
- `RentalStarted`
- `RentalEnded`
- `ScooterBatteryLow`
- `ScooterTelemetryReceived`

Los domain events sirven para desacoplar efectos secundarios (¿qué pasa cuando un alquiler termina?) de la lógica principal. No son obligatorios para el ejercicio, pero si los implementás, van a hacer que el código sea significativamente más limpio.

---

## 1.2 — Separation of Concerns

Cada capa tiene una responsabilidad exclusiva. Si mezclás responsabilidades, el código se vuelve difícil de testear y de cambiar.

### Las cuatro capas y lo que cada una hace

**Domain** — Sabe qué es el negocio. No sabe nada de HTTP, de Postgres, de Redis, ni de Pino. Si borrás toda la infraestructura y dejás solo el dominio, el negocio sigue teniendo sentido.

**Application** — Orquesta el dominio para cumplir un caso de uso. Recibe inputs, llama al dominio, coordina repositorios. No contiene lógica de negocio propia — esa vive en el dominio.

**Infrastructure** — Implementa las interfaces que el dominio y la aplicación definieron. Aquí vive Postgres, Redis, Pino, y Prometheus. Esta capa sabe cómo hablar con el mundo exterior.

**HTTP** — Traduce requests HTTP a llamadas a los casos de uso. Traduce las respuestas de los casos de uso a responses HTTP. No contiene lógica de negocio ni de persistencia.

### Señales de que estás mezclando responsabilidades

- Un route handler hace un query a la base de datos directamente.
- Una entidad del dominio importa algo de `pg` o `redis`.
- Un caso de uso construye una respuesta HTTP.
- Un repositorio contiene lógica de negocio (decisiones de qué hacer con los datos).
- Un controller valida reglas de negocio (más allá de validación de formato del request).

### La pregunta que tenés que hacerte antes de escribir cada función

*"Si mañana cambio Postgres por MongoDB, ¿tengo que tocar este archivo?"*

Si la respuesta es sí y el archivo no está en `infrastructure/`, hay un problema de diseño.

---

## 1.3 — Design Patterns

Los siguientes patrones resuelven problemas concretos que vas a encontrar en este ejercicio. No los apliques porque "hay que aplicarlos" — aplicalos cuando sientas el dolor del problema que resuelven.

### Repository Pattern

Abstrae el acceso a datos detrás de una interfaz orientada al dominio. El dominio no sabe si los datos vienen de Postgres, de un archivo, o de memoria.

**Problema que resuelve:** Los casos de uso no deberían saber nada de SQL. Si el día de mañana querés testear `StartRentalUseCase`, no deberías necesitar una base de datos real.

**Cómo aplicarlo en VoltRide:** Definí las interfaces de repositorio en `domain/`. Implementalas en `infrastructure/`. Los casos de uso reciben la interfaz, no la implementación.

**Lo que tenés que pensar:**
- ¿Qué métodos necesita el repositorio de Scooter? Pensá desde los casos de uso hacia atrás.
- ¿Cómo guardás una entidad que tiene value objects anidados?
- ¿Cómo reconstituís una entidad desde una fila de la DB sin violar el encapsulamiento?

### Strategy Pattern

Define una familia de algoritmos, los encapsula, y los hace intercambiables. El cliente no sabe cuál estrategia está usando.

**Problema que resuelve en VoltRide:** El precio de un alquiler puede calcularse de distintas formas — tarifa fija por minuto, tarifa variable según la hora del día, descuento para usuarios frecuentes. Si ponés esa lógica en el caso de uso con `if/else`, cada vez que agregan una nueva política de precios tocás código existente.

**Cómo aplicarlo:** Definí una interfaz `PricingStrategy` con un método `calculate(rental: Rental): number`. Implementá al menos dos estrategias concretas. El caso de uso de fin de alquiler recibe una estrategia por constructor — no sabe cuál es.

### Factory Pattern

Centraliza la creación de objetos complejos.

**Problema que resuelve en VoltRide:** Crear una entidad `Scooter` o `Rental` implica validaciones, generación de IDs, timestamps. Si esa lógica está dispersa, es fácil crear objetos en estado inválido.

**Cómo aplicarlo:** Las entidades no deberían tener constructores públicos. Usá métodos estáticos de fábrica (`Scooter.create(...)`, `Rental.start(...)`) que encapsulan las validaciones y garantizan que el objeto nace en un estado válido.

También pensá en una `ScooterFactory` para reconstituir entidades desde la base de datos — crear desde cero y reconstituir desde persistencia son dos operaciones distintas con reglas distintas.

### Observer Pattern (opcional, se conecta con Domain Events)

Permite que objetos "suscritos" reaccionen a eventos sin que el emisor sepa quiénes son.

**Problema que resuelve en VoltRide:** Cuando un scooter llega a batería baja, podrían pasar varias cosas: notificar al operador, actualizar métricas, encolar una tarea de mantenimiento. Si ponés todo eso en `UpdateTelemetryUseCase`, ese caso de uso termina teniendo demasiadas responsabilidades.

**Cómo aplicarlo:** Implementá un `EventBus` simple. Los casos de uso publican eventos (`ScooterBatteryLow`). Los handlers suscritos reaccionan de forma independiente. El caso de uso no sabe cuántos handlers hay ni qué hacen.

### Decorator Pattern

Agrega comportamiento a un objeto sin modificarlo.

**Problema que resuelve en VoltRide:** Querés que el repositorio de Scooter loguee cada operación, o que registre métricas. Podrías ponerlo directamente en `PostgresScooterRepository`, pero entonces mezclás infraestructura de datos con infraestructura de observabilidad.

**Cómo aplicarlo:** Creá un `LoggedScooterRepository` que implementa `ScooterRepository`, recibe otro `ScooterRepository` por constructor, y agrega logging alrededor de cada llamada. El caso de uso no sabe si está usando el repositorio con o sin logging.

---

## 1.4 — SOLID en la práctica

No repito los principios porque ya los viste. Lo que sí vale la pena marcar es cómo se manifiestan concretamente en este ejercicio.

**SRP:** Cada caso de uso hace exactamente una cosa. `StartRentalUseCase` no manda emails, no calcula precios, no loguea resultados de negocio — delega.

**OCP:** Agregar una nueva estrategia de precios no debería tocar ningún archivo existente. Agregar un nuevo handler de eventos no debería tocar el caso de uso que emite el evento.

**LSP:** Si tenés `InMemoryScooterRepository` para tests, tiene que ser intercambiable con `PostgresScooterRepository` sin que los casos de uso lo noten. Si uno lanza excepciones que el otro no lanza, o si sus contratos difieren, rompiste LSP.

**ISP:** El repositorio de Scooter no tiene que tener un método `backup()` solo porque lo tiene otro repositorio. Interfaces pequeñas y enfocadas.

**DIP:** Los casos de uso reciben sus dependencias (repositorios, logger, metrics, pricing strategy) por constructor. Nunca hacen `new PostgresScooterRepository()` adentro. Esto es lo que hace posible testearlos en aislamiento.

---

## Checkpoints del Módulo 1

Usá esta lista para validar tu trabajo antes de avanzar al módulo 2.

### Diseño general
- [ ] Ningún archivo en `domain/` importa algo de `infrastructure/` o de `http/`
- [ ] Ningún route handler contiene lógica de negocio
- [ ] Ningún caso de uso contiene queries SQL o llamadas a Redis
- [ ] Podés reemplazar `PostgresScooterRepository` por `InMemoryScooterRepository` sin tocar ningún caso de uso

### DDD
- [ ] Las entidades tienen métodos que expresan operaciones del negocio (no solo getters/setters)
- [ ] Los Value Objects son inmutables y tienen sus propias validaciones
- [ ] La lógica de "¿puede este scooter ser alquilado?" vive en la entidad, no en el caso de uso
- [ ] Los errores de negocio son tipos específicos (`ScooterNotAvailableError`), no strings genéricos

### Design Patterns
- [ ] Las entidades se crean solo a través de métodos de fábrica — no hay `new Scooter({...})` disperso por el código
- [ ] Hay al menos dos implementaciones de `PricingStrategy`
- [ ] `StartRentalUseCase` no sabe qué estrategia de precios está usando
- [ ] El repositorio con logging es un decorator, no una modificación del repositorio original

### Testing
- [ ] Podés correr los unit tests sin Docker levantado
- [ ] Los unit tests de `Scooter` cubren: creación válida, creación inválida, transiciones de estado correctas, transiciones de estado inválidas
- [ ] Los casos de uso se testean con repositorios in-memory, sin DB real
- [ ] Hay al menos un integration test que usa Postgres real (en Docker) para verificar que las queries funcionan

### Pregunta de cierre
Antes de avanzar, respondé esto sin mirar el código: *"Si mañana el negocio decide que un scooter con batería menor al 20% (en vez de 15%) no puede alquilarse, ¿en qué único archivo tocás?"* Si la respuesta no es inmediata y no es un único archivo, revisá el diseño.

---

---

# Módulo 2 — Observabilidad

**Conceptos a aplicar:** Structured logging · Correlation IDs · Métricas con Prometheus · Health checks

Un sistema no observable es un sistema que no podés operar en producción. Podés tener el código más hermoso del mundo, pero si no podés responder "¿qué pasó a las 14:32 cuando el usuario 42 intentó alquilar un scooter?", el sistema no está listo.

---

## Requerimientos de observabilidad

### Logging estructurado

Todos los logs tienen que ser JSON. Nada de `console.log('Rental started')`. Los logs tienen que poder ser parseados por máquinas (Datadog, Loki, CloudWatch).

**Lo que cada log debe incluir:**
- `timestamp` — automático con Pino
- `level` — info, warn, error, debug
- `service` — el nombre de tu aplicación
- `correlationId` — el ID único del request que generó este log
- `userId` — cuando aplique
- Campos adicionales relevantes al contexto

**Qué loguear en cada flujo crítico:**

*Inicio de alquiler:*
- Cuando llega el request (con scooterId y userId)
- Cuando el scooter es encontrado (con su estado actual)
- Cuando el alquiler es creado exitosamente (con rentalId)
- Si el scooter no está disponible (como WARN, no ERROR — es un caso de negocio esperado)
- Si algo falla inesperadamente (como ERROR con stack trace)

*Telemetría:*
- Cada lectura recibida (como DEBUG — va a ser muy frecuente)
- Cuando un scooter baja del umbral de batería (como WARN)

*Errores inesperados:*
- Siempre con stack trace completo
- Con el contexto del request que los originó

**Lo que no hace falta loguear:**
- Cada query SQL (demasiado ruido)
- Datos sensibles (emails, contraseñas, tokens)
- Respuestas exitosas de health checks (ruido innecesario)

### Correlation IDs

Cada request HTTP tiene que generar (o propagar) un ID único que aparezca en todos los logs generados durante ese request. Si un request dispara tres queries a la DB y dos llamadas a Redis, todos esos eventos tienen que tener el mismo `correlationId`.

**Cómo funciona:** Un middleware al inicio de cada request genera el ID si no viene en el header `X-Correlation-Id`, y lo inyecta en el logger. El mismo ID se devuelve en el header de respuesta para que el cliente pueda trackearlo.

**Prueba de fuego:** Abrí los logs de una request fallida. Con solo el `correlationId`, tenés que poder reconstruir la historia completa de lo que pasó, en orden cronológico.

### Métricas con Prometheus

Exponé un endpoint `GET /metrics` en formato Prometheus. Las métricas mínimas que tenés que exponer:

**Métricas de negocio:**
- Total de alquileres iniciados
- Total de alquileres finalizados
- Total de búsquedas de scooters disponibles (separando cache hits y cache misses)

**Métricas de sistema:**
- Duración de requests HTTP (como histograma, con labels de método, ruta y status code)
- Cantidad de requests activos en este momento

**Cómo medirlas:** Un middleware que registra el inicio del request y, cuando termina, registra la duración. El caso de uso incrementa el contador de alquileres cuando corresponde.

### Health Check

`GET /health` tiene que verificar conectividad real con las dependencias, no solo que el proceso está vivo.

**Lo que tiene que responder:**
- Estado general: `ok` o `degraded`
- Estado de cada dependencia por separado (DB, Redis)
- Uptime del proceso
- Timestamp

**Regla importante:** Si la DB está caída, el health check responde con status HTTP 503, no 200. Muchos sistemas de orquestación (Kubernetes) usan este endpoint para decidir si mandar tráfico al proceso.

---

## Checkpoints del Módulo 2

- [ ] Todos los logs son JSON válido — ningún `console.log` en el código de producción
- [ ] Cada request tiene un `correlationId` que aparece en todos sus logs
- [ ] Los errores de negocio (scooter no disponible) son WARN, los bugs son ERROR
- [ ] `GET /health` responde 503 cuando la DB está caída
- [ ] `GET /metrics` expone datos reales, no placeholders
- [ ] Podés encontrar todos los logs de una request específica filtrando por `correlationId`
- [ ] Los logs incluyen el userId cuando está disponible

**Prueba de fuego:**
1. Iniciá la API
2. Hacé un request de alquiler con un scooter que no existe
3. Encontrá ese request en los logs usando solo el `correlationId` del header de respuesta
4. Verificá que el log de error tiene el contexto suficiente para entender qué pasó sin debuggear

---

---

# Módulo 3 — Performance y escalabilidad

**Conceptos a aplicar:** Caching con Redis · Cache invalidation · Rate limiting · Connection pooling · Load testing

Un sistema que funciona para 10 usuarios concurrentes no necesariamente funciona para 1000. Este módulo te obliga a pensar en cómo se comporta el sistema bajo carga.

---

## Requerimientos de performance

### Cache de búsquedas geoespaciales

El endpoint más consultado es `GET /scooters/available`. Cada consulta implica un query geoespacial en Postgres que puede ser costoso. Bajo carga alta, esto puede saturar la base de datos.

**Lo que tenés que implementar:**
- Cache en Redis para los resultados de búsqueda de scooters disponibles
- Una estrategia de key que agrupe búsquedas en la misma zona geográfica (pensá en qué precisión tiene sentido — ¿necesitás distinguir entre `-34.6037` y `-34.6038`?)
- Un TTL apropiado para el negocio (¿cuánto tiempo puede estar desactualizada esta información?)
- Invalidación del cache cuando el estado de algún scooter cambia

**Preguntas de diseño que tenés que responder:**
- ¿Qué pasa si Redis se cae? ¿El endpoint falla o degrada gracefully?
- ¿Cómo invalidás el cache cuando un scooter cambia de `available` a `in_use`?
- ¿Es mejor invalidar por scooter individual o invalidar todo el cache de búsquedas?

**Métrica de éxito:** El endpoint de búsqueda responde en < 50ms cuando el cache está caliente, y < 500ms cuando no lo está.

### Rate limiting en telemetría

El endpoint `POST /telemetry` recibe datos de cada monopatín cada 30 segundos. Con 500 monopatines, el volumen esperado es ~17 requests por segundo. Un bug en el firmware de un monopatín podría disparar miles de requests por segundo desde ese vehículo y saturar el sistema.

**Lo que tenés que implementar:**
- Rate limiting por `scooterId` — cada monopatín tiene su propio límite
- Respuesta 429 con header `Retry-After` cuando se supera el límite
- El límite tiene que ser configurable, no hardcodeado

**Algoritmos de rate limiting que podés investigar:**
- Token bucket
- Fixed window counter
- Sliding window log (con Redis sorted sets)

Cada uno tiene trade-offs distintos. Elegí uno y podé explicar por qué.

**Pregunta de diseño:** ¿Dónde vivé el rate limiter en la arquitectura? ¿Es un middleware de HTTP, un servicio de la capa de aplicación, o algo de infraestructura? Justificá tu decisión.

### Connection pooling

La base de datos tiene un límite de conexiones concurrentes. Si cada request abre y cierra su propia conexión, bajo carga alta vas a agotar las conexiones disponibles y el sistema va a fallar.

**Lo que tenés que configurar:**
- Un pool de conexiones que se crea una vez al iniciar el servidor
- Tamaño máximo del pool apropiado para la carga esperada
- Timeout de conexión y de idle
- El pool tiene que estar disponible para inyección de dependencias — no como variable global

**Señal de que está bien hecho:** Si hacés un load test con 100 requests concurrentes, el pool maneja la cola sin errores de "too many connections".

---

## Load test

Escribí un load test con k6 que valide las siguientes condiciones bajo carga sostenida:

- 100 usuarios virtuales concurrentes durante 1 minuto
- El percentil 95 de duración de requests es menor a 500ms
- La tasa de errores (status 5xx) es menor al 1%
- El endpoint de búsqueda muestra un cache hit rate mayor al 70%

El test tiene que incluir al menos dos escenarios:
1. Búsquedas de scooters disponibles (el flujo más frecuente)
2. Inicio y fin de alquileres (el flujo más crítico)

---

## Checkpoints del Módulo 3

- [ ] El pool de Postgres se crea una sola vez al iniciar — no dentro de handlers
- [ ] `GET /scooters/available` responde en < 50ms con cache caliente
- [ ] Cuando un scooter cambia de estado, el cache de búsquedas se invalida
- [ ] Si Redis se cae, el endpoint de búsqueda sigue funcionando (va directo a la DB)
- [ ] `POST /telemetry` responde 429 cuando un scooter excede el límite de requests
- [ ] Los logs distinguen claramente "cache hit" de "cache miss"
- [ ] El load test pasa con los umbrales definidos

**Prueba de fuego:**
1. Levantá el sistema con Docker Compose
2. Corrí el load test
3. Abrí el endpoint `/metrics` durante el test
4. Verificá que las métricas reflejan lo que está pasando en tiempo real
5. Matá Redis mientras el test está corriendo — el sistema tiene que degradar, no caerse

---

---

# Milestones

Tratá cada sprint como una entrega real. No avancés al siguiente hasta que podés cumplir la definición de hecho.

### Sprint 1 — Dominio y estructura (1 semana)

**Qué construir:** Scaffolding del proyecto, entidades del dominio con toda la lógica de negocio, interfaces de repositorios, unit tests de las entidades.

**Definición de hecho:**
- Las entidades `Scooter` y `Rental` tienen sus invariantes protegidas
- Los unit tests de dominio pasan sin Docker
- Podés explicar sin mirar el código qué archivo tocar si cambia el umbral de batería baja
- La estructura de carpetas está definida y los imports respetan las reglas de capas

### Sprint 2 — Persistencia y casos de uso (1 semana)

**Qué construir:** Implementaciones de repositorios en Postgres, todos los casos de uso, endpoints HTTP básicos, integration tests.

**Definición de hecho:**
- Podés iniciar y terminar un alquiler via API
- La telemetría actualiza el estado del scooter en la DB
- Los integration tests corren contra Postgres en Docker
- Los casos de uso se testean con repositorios in-memory

### Sprint 3 — Observabilidad (1 semana)

**Qué construir:** Logger estructurado, correlation IDs, métricas, health check, error handler centralizado.

**Definición de hecho:**
- Cada request genera logs JSON con `correlationId`
- `/metrics` expone datos reales
- Podés simular un error y encontrarlo en los logs en < 30 segundos usando el `correlationId`
- `/health` responde 503 cuando la DB está caída

### Sprint 4 — Performance (1 semana)

**Qué construir:** Redis, cache de búsquedas con invalidación, rate limiting, configuración de pool, load test.

**Definición de hecho:**
- El endpoint de búsqueda tiene < 50ms con cache caliente
- El rate limiting rechaza requests excesivos con 429
- El load test pasa los umbrales definidos
- El sistema degrada gracefully cuando Redis se cae

---

---

# Señales de que vas por buen camino

- Podés correr todos los unit tests sin Docker
- Agregar una nueva estrategia de precios no requiere tocar ningún caso de uso existente
- Al leer los logs de una request fallida, sabés en qué paso exacto del flujo falló
- Un developer nuevo puede entender la estructura del proyecto sin que le expliques nada
- El load test muestra un cache hit rate estable > 70% bajo carga

# Señales de que algo está mal

- Los tests necesitan una DB real para correr
- Un route handler tiene más de ~20 líneas de código
- Hay SQL en los casos de uso
- Hay lógica de negocio en los repositorios
- `console.log` aparece en el código de producción
- El pool de conexiones se crea dentro de un request handler

---

# Recursos

**Diseño de software y DDD**
- *Clean Architecture* — Robert C. Martin
- *Domain-Driven Design Distilled* — Vaughn Vernon

**Observabilidad**
- Documentación de Pino: getpino.io
- OpenTelemetry para Node.js: opentelemetry.io/docs/languages/js

**Performance**
- Documentación de `node-postgres` pool: node-postgres.com/apis/pool
- k6 docs: k6.io/docs
