# Telar — Mejoras propuestas (backend y frontend)

Basado en el seguimiento del 2026-09-04, revisado contra el código el 2026-09-04
más tarde el mismo día, y actualizado ese mismo día tras implementar los
4 "quick wins" de frontend. De los 15 puntos originales, **11 ya están
resueltos** — quedan 4 puntos, todos deliberadamente pospuestos o de
prioridad baja. Abajo: primero el plan de trabajo para lo que queda, después
el detalle de qué se resolvió y dónde.

---

## Plan de trabajo (lo que queda)

Nada de esto es urgente — por eso quedó para el final la vez pasada. Orden
sugerido por impacto/esfuerzo, no por dependencia (son todos independientes
entre sí):

| # | Tarea | Lado | Esfuerzo | Nota |
|---|---|---|---|---|
| 1 | Indicador de sesión por expirar | Frontend + Backend | Mediano-Grande | **Ojo:** hoy no existe endpoint de refresh (`telar/auth/router.py` solo tiene `login`/`me`/`change_password`). Avisar es fácil (decodificar el JWT en el cliente y avisar antes del `exp`); "refrescar sin perder lo escrito" necesita un `POST /auth/refresh` nuevo en el backend. Si no se quiere tocar backend todavía, se puede lanzar solo el aviso con un link a "volver a entrar" en vez de refresh silencioso. |
| 2 | Rotación/segmentación de `ENCRYPTION_KEY` | Backend | Grande | Sigue siendo una sola clave global (`config.py:24`, `core/crypto.py:20`) cifrando los secretos de todas las cuentas. No es una tarea de una sesión: hay que decidir el esquema (clave por cuenta vs. rotación con reenvelopment) y migrar los secretos ya cifrados. Vale la pena planearlo ahora que hay pocos datos, aunque no se implemente ya. |
| 3 | Índice `pg_trgm` para búsquedas `ILIKE` | Backend | Chico (cuando toque) | Confirmado: sigue sin existir en `migrations/`. Recomendación original se mantiene tal cual — **no lo hagas todavía**, es una optimización que se justifica sola cuando la tabla de contactos crezca. Dejarlo acá como recordatorio, no como tarea de esta ronda. |

Los puntos 1 y 2 son los que valen una conversación de diseño antes de tocar
código (uno porque toca el backend de auth, el otro porque es un cambio de
esquema de cifrado) — no hace falta resolverlos ahora, pero sí vale la pena
tenerlos en mente para no llegar tarde. El punto 3 no se agenda: se dispara
solo cuando el volumen de contactos lo pida.

---

## Resueltas desde el seguimiento anterior

Verificado contra el código, no solo contra el historial de commits:

- **Backend #1 — Tests de integración del flujo completo.** `telar/tests/integration/test_pipeline.py` cubre exactamente lo que pedía el punto: webhook → dispatcher → pipeline → agente → envío contra Postgres real, más un test de `recover_pending()` simulando un proceso que murió a mitad de camino.
- **Backend #2 — Cerrar el círculo de `delivery_status`.** `channels/meta.py` ya procesa el bloque `statuses` del webhook (línea 125) y lo pasa a `repositories.update_message_delivery_status`.
- **Backend #3 — Persistir mensajes descartados por rate limit.** `Dispatcher` ahora acepta `on_rate_limited` (`worker/dispatcher.py`), conectado en `api/main.py` a `pipeline.handle_rate_limited`, que llama a `repo.save_inbound_rate_limited` con estado `'rate_limited'`.
- **Backend #4 — Dividir `db/repositories.py` por dominio.** Ya no es un archivo único: `db/repositories/` tiene `accounts.py`, `auth.py`, `bots.py`, `conversations.py`, `inboxes.py`, `kb.py`, `llm.py`, `tenant_db.py`, `tools.py` y `audit.py`, reexportados desde `__init__.py`.
- **Backend #5 — `json.loads(raw)` sin manejo defensivo.** `api/main.py:inbound` ya envuelve el parseo en `try/except json.JSONDecodeError`, devuelve 200 igual y loguea el body crudo.
- **Backend #6 — Validar que la tool `sql` es Postgres-only.** `custom_tools/sql_tool.py` tiene `check_connection_is_postgres()`, que rechaza la connection string al crear/editar la tool si no es `postgres://`/`postgresql://`.
- **Backend #8 — Log de auditoría mínimo.** `db/repositories/audit.py` con `insert_audit_log(account_id, user_id, action, entity_type, entity_id)`.

Y de yapa, sin que nadie lo pidiera aparte: **Frontend #1** (`delivery_status`
en `MessageBubble.tsx`) ya no necesita ningún cambio — la UI ya sabía
renderizar `delivered`/`read`, solo esperaba a que el backend #2 mandara esos
estados. Con #2 resuelto, quedó cerrado solo.

### Ronda 2 — los 4 "quick wins" de frontend (2026-09-04, misma tarde)

- **Aviso de mensaje nuevo fuera de foco.** `lib/useNewMessageTitleAlert.ts`
  (nuevo), enganchado en `AccountLayout.tsx`. Sondea cada 8s incluso con la
  pestaña en segundo plano y cambia `document.title` a `(N) Telar` mientras
  haya mensajes nuevos sin ver.
- **Aclarar "Postgres-only" en el hint de la tool `sql`.**
  `settings/tools/toolFormConstants.ts` línea 20.
- **Dividir `LlmProvidersTab.tsx`.** De 568 a 162 líneas. Los diálogos
  (`CreateProviderDialog`, `EditProviderDialog`, `DeleteProviderDialog`) y
  `ModelDiscoveryField` pasaron a `settings/providers/`, mismo patrón que
  `settings/tools/`. `NodeEditPanel.tsx` actualizado a los imports nuevos.
- **Estado "offline" explícito.** `lib/networkStatus.ts` (nuevo, store
  mínimo tipo pub-sub) + `components/layout/OfflineBanner.tsx` (nuevo),
  montado en `AccountLayout.tsx`. `lib/api.ts` reporta fallo solo cuando
  `fetch()` mismo tira excepción (falla de red real, no un 4xx/5xx).

Los cuatro, verificados con `tsc -b --noEmit`, `oxlint` y `vite build`
completo sin errores.

