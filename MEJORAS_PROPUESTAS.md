# Telar — Mejoras propuestas (backend y frontend)

Basado en el seguimiento del 2026-09-04. Con los hallazgos críticos y altos ya resueltos, esto es lo que queda para seguir puliendo el producto, separado por lado.

---

# BACKEND

### 1. Tests de integración del flujo completo — PRIORIDAD ALTA

**Problema:** no existe ni un solo test que cubra webhook → dispatcher → pipeline → agente → envío. La suite actual (`test_compiler.py`, `test_custom_tools.py`, `test_security.py`, `test_setup.py`) solo cubre lógica pura y aislada. `test_ratelimit.py` directamente desapareció al mover el limiter a Postgres, así que hoy hay menos cobertura que antes de la última ronda de cambios.

**Por qué ahora:** el dispatcher y el rate limiter acaban de pasar de memoria a Postgres — es el momento en que más conviene tener tests, no menos, y ya se puede probar contra una Postgres real (testcontainers o una DB de test) sin mockear media arquitectura.

**Recomendación:** al menos un test que simule un payload de Meta completo, verifique que el mensaje llega a la base, se debounce, se procesa y se guarda la respuesta; y un test de `recover_pending()` simulando un reinicio a mitad de proceso.

---

### 2. Cerrar el círculo de `delivery_status` — PRIORIDAD MEDIA

**Problema:** `channels/meta.py` sigue descartando los webhooks de estado de Meta (`if "messages" not in value: continue`). Ningún mensaje saliente pasa nunca de `sent`/`failed` a `delivered`/`read`, aunque el frontend ya sabe renderizar esos estados.

**Recomendación:** procesar el bloque `statuses` del webhook (Meta lo manda en el mismo `value` que los mensajes) y actualizar `delivery_status` en la base cuando llegue. Es un cambio acotado: un `if "statuses" in value` junto al que ya existe para `"messages"`, con su propio `UPDATE` en `repositories.py`.

---

### 3. Persistir mensajes descartados por rate limit — PRIORIDAD MEDIA

**Problema:** `dispatcher.py:submit()` sigue haciendo `log.warning(...); return` cuando un contacto se pasa del límite — el mensaje ni siquiera llega a la base, así que ningún agente humano se entera de que el bot "se quedó mudo" con ese contacto.

**Recomendación:** con el rate limiter ya en Postgres, es un cambio chico: guardar el mensaje con un `delivery_status`/estado tipo `rate_limited` en vez de solo loguearlo, para que aparezca en la bandeja aunque no se le pase al agente.

---

### 4. Dividir `db/repositories.py` por dominio — PRIORIDAD MEDIA

**Problema:** sigue siendo un único archivo con más de 60 funciones de todos los dominios (auth, cuentas, conversaciones, tools, KB, LLM, inboxes, bots, tenant_db, rate limiting, buffer de mensajes). Creció de 1.228 a 1.384 líneas en la última ronda de cambios — cuanto más se espera, más grande es el refactor.

**Recomendación:** dividir en `db/repositories/{auth,accounts,conversations,tools,kb,llm,inboxes,bots,tenant_db,ratelimit}.py`, re-exportando desde `__init__.py` para no romper el import actual (`from telar.db import repositories as repo`). Sin urgencia funcional, pero el costo solo sube con el tiempo.

---

### 5. `json.loads(raw)` del webhook sin manejo defensivo — PRIORIDAD MEDIA-BAJA

**Problema:** ya se arregló el caso más común (un mensaje del lote con un campo inesperado, ahora aislado en su propio `try/except`), pero el `json.loads(raw)` en `api/main.py:inbound` sigue sin protección. Si Meta llega a mandar un body que ni siquiera es JSON válido, sigue tumbando todo el request con 500.

**Recomendación:** envolverlo también, devolviendo 200 igual (para que Meta no reintente indefinidamente un payload que nunca va a poder parsear) pero logueando el body crudo para diagnóstico.

---

### 6. Advertir/validar que la tool `sql` es Postgres-only — PRIORIDAD BAJA

**Problema:** `custom_tools/sql_tool.py` sigue usando `psycopg.AsyncConnection.connect()` de forma incondicional, sin ninguna validación de que la conexión configurada sea efectivamente Postgres.

**Recomendación:** si no se va a soportar MySQL en esta tool (a diferencia de `tenant_db`, que sí lo soporta), al menos fallar rápido con un mensaje claro al crear/editar la tool si la connection string no parece de Postgres, en vez de un error genérico recién en la primera invocación real.

---

### 7. Rotación/segmentación de la clave de cifrado — PRIORIDAD BAJA (planificar, no urgente)

**Problema:** una sola `ENCRYPTION_KEY` global sigue cifrando los secretos de todas las cuentas de la instalación (tokens de Meta, API keys de LLM, credenciales de tools, contraseñas de bases externas). Aceptable para v0 autoalojado por un solo operador; se vuelve un problema real el día que Telar aloje más de un cliente no relacionado en la misma instancia.

**Recomendación:** planear la migración a clave por cuenta (o al menos soporte de rotación) antes de que haga falta con urgencia — es mucho más fácil de introducir ahora, con pocos datos cifrados en producción, que después.

---

### 8. Log de auditoría mínimo — PRIORIDAD BAJA

**Problema:** ningún cambio de credencial de inbox, tool, proveedor LLM o conexión de base de datos externa queda registrado con quién lo hizo y cuándo, más allá de logs de aplicación genéricos.

**Recomendación:** una tabla simple (`audit_log`: cuenta, usuario, acción, entidad, timestamp) con un insert en cada mutación sensible ya existente. Barato de agregar, alto beneficio el día que haga falta investigar algo.

---

### 9. Índice de texto para búsquedas `ILIKE` — PRIORIDAD BAJA (optimización futura, no bug)

**Problema:** `get_contacts_for_account`/`get_conversations_for_account` siguen usando `ILIKE '%...%'` sin índice `pg_trgm`/GIN. No se nota con pocos cientos de contactos, pero a partir de cierto volumen cada búsqueda es un escaneo completo de tabla.

**Recomendación:** agregar el índice `pg_trgm` cuando el volumen real de contactos lo empiece a justificar — no antes, para no invertir tiempo en una optimización que hoy no hace falta.

---

# FRONTEND

### 1. `delivery_status` — coherencia con el backend — PRIORIDAD MEDIA

**Problema:** `MessageBubble.tsx` (`DeliveryIndicator`) ya sabe renderizar `'delivered'` (doble check) y `'read'` (doble check azul), pero esos estados nunca van a llegar hasta que se implemente el punto 2 del backend. Es UI terminada esperando una función que no existe.

**Recomendación:** si el punto 2 de backend se prioriza, no hace falta tocar nada acá. Si se decide postergarlo, vale la pena ocultar esos dos estados de la UI mientras tanto (dejar solo `sent`/`failed`) para no mostrarle al agente una promesa que el sistema no cumple.

---

### 2. Aclarar que la tool `sql` es Postgres-only — PRIORIDAD BAJA

**Problema:** el `KIND_HINT` de `toolFormConstants.ts` para `sql` dice "Consulta tu propia base de datos, siempre de solo lectura" — no aclara que solo funciona contra Postgres.

**Recomendación:** un texto corto alcanza: "Consulta tu propia base de datos Postgres, siempre de solo lectura." Evita que un cliente con MySQL arme una tool que va a fallar en cada invocación.

---

### 3. Indicador de "sesión a punto de expirar" — PRIORIDAD BAJA

**Problema:** sigue sin existir ningún aviso antes del 401 forzoso — el usuario se entera de que su sesión expiró recién cuando una acción falla.

**Recomendación:** un aviso simple (toast o banner) cuando falta poco para que expire el JWT, con opción de refrescar sesión antes de perder lo que estaba escribiendo (por ejemplo, un mensaje largo a medio redactar en el composer).

---

### 4. Estado "offline" explícito — PRIORIDAD BAJA

**Problema:** si la API deja de responder, lo único que ve el usuario es un toast de error puntual por cada mutación que falla — no hay un estado global de "no hay conexión con el servidor".

**Recomendación:** un indicador persistente (banner superior, por ejemplo) cuando varias requests seguidas fallan por timeout/network error, en vez de que cada intento del usuario se tope con su propio toast aislado.

---

### 5. Sin aviso de mensaje nuevo fuera de foco — PRIORIDAD BAJA

**Problema:** el polling (5-8s) solo corre mientras la pestaña está activa; un agente en otra pestaña o pantalla no se entera de una conversación nueva hasta que vuelve a la bandeja.

**Recomendación:** un sonido discreto o un cambio en el título de la pestaña (`(1) Telar — Bandeja`) cuando llega un mensaje nuevo y la pestaña no está en foco. No es indispensable para v0, pero es la mejora de producto con más impacto en el día a día de un agente que atiende varias cuentas.

---

### 6. `LlmProvidersTab.tsx` sigue siendo el componente más grande de `settings/` — PRIORIDAD BAJA

**Problema:** quedó en 568 líneas después de la última ronda de refactors — no tan crítico como el `ToolsTab.tsx`/`TeamPage.tsx` originales, pero es el único de `settings/` que no se dividió en esta ronda.

**Recomendación:** aplicar el mismo patrón ya usado en `tools/` y `team/` — extraer `CreateProviderDialog`/`EditProviderDialog`/`DeleteProviderDialog` a su propia carpeta. Cosmético, pero mantiene el estándar parejo en todo `settings/`.
