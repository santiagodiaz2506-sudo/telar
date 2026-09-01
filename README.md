# Telar

Plataforma open source para construir agentes conversacionales sobre WhatsApp Cloud API.

Telar recibe los mensajes de Meta, los pasa por un agente construido con LangGraph y devuelve la respuesta. Cuando el agente detecta que el caso necesita una persona, suelta la conversación y no vuelve a hablar hasta que el asesor la cierre.

Está pensado para quien ya tiene un número aprobado en Meta y quiere operarlo con sus propios modelos, su propia base de datos y su propio servidor.

> Estado: v0 en construcción. Funciona el ciclo completo de mensajes con un solo número. La bandeja de entrada, los roles y el constructor visual de flujos vienen después.

## Por qué existe

Hoy la opción es armar el flujo en una herramienta no-code que cobra por conversación, o programar cada bot desde cero contra la API de Meta. Telar es la capa intermedia: la fontanería difícil resuelta, y el agente definido por ti.

Lo que ya está resuelto y suele salir mal cuando se hace a mano:

- El webhook responde `200` de inmediato y procesa aparte. Si tardas, Meta reintenta y el bot contesta dos veces.
- Deduplicación por `message.id` con índice único en base de datos.
- Validación de la firma `X-Hub-Signature-256`. Sin eso, tu endpoint es público.
- Agrupación de ráfagas: la gente manda tres mensajes seguidos y el agente los ve como un turno.
- Orden garantizado por contacto. Dos ráfagas no se cruzan.
- La ventana de servicio de 24 horas se verifica antes de enviar.
- El traspaso a humano es una máquina de estados explícita, no una improvisación dentro del prompt.

## Cómo funciona

```
Meta Cloud API
      │  webhook
      ▼
API de ingesta ......... valida firma, deduplica, responde 200
      │
      ▼
Dispatcher ............. agrupa la ráfaga, garantiza orden por contacto
      │
      ▼
Pipeline ............... ¿la conversación es del bot o de un humano?
      │
      ▼
Agente LangGraph ....... modelo + herramientas + memoria en Postgres
      │
      ▼
Adaptador de canal ..... traduce y envía
```

La regla que sostiene el diseño: **ni el agente ni la lógica de negocio ven un payload de Meta.** Todo entra como `InboundMessage` y sale como `OutboundMessage`. Agregar Telegram o webchat es escribir un adaptador nuevo, no tocar el agente.

## Arranque rápido

Necesitas Docker, un número de WhatsApp aprobado en Meta y una clave de algún proveedor de modelos.

```bash
git clone https://github.com/<tu-usuario>/telar.git
cd telar
cp .env.example .env
```

Llena `.env` con los datos de tu app de Meta. El `META_VERIFY_TOKEN` lo inventas tú: es una cadena aleatoria que después pegas en la consola de Meta.

```bash
docker compose up -d db
docker compose up api
```

El esquema se aplica solo la primera vez que arranca la base de datos.

### Exponer el webhook

Meta necesita una URL pública con HTTPS. En desarrollo:

```bash
docker compose --profile dev up tunnel
```

Con el token de tu túnel de Cloudflare en `CLOUDFLARE_TUNNEL_TOKEN`. En producción usa tu propio reverse proxy; el túnel es una comodidad de desarrollo, no parte del núcleo.

En la consola de Meta, apunta el webhook a `https://tu-dominio/webhooks/whatsapp`, pega el mismo verify token y suscríbete al campo `messages`.

### Registrar tu número

El `phone_number_id` es la llave que enruta cada webhook hacia su cuenta, su bot y su base de conocimiento. Créalo una vez:

```sql
INSERT INTO accounts (name) VALUES ('Mi empresa') RETURNING id;

INSERT INTO inboxes (account_id, name, phone_number_id, waba_id)
VALUES ('<el id de arriba>', 'Principal', '<tu phone_number_id>', '<tu waba_id>');
```

Escríbele a tu número. Debería contestarte.

## Configuración

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Tu Postgres. Guarda estado, memoria del agente y vectores. |
| `META_APP_SECRET` | Valida que el webhook venga de Meta. |
| `META_VERIFY_TOKEN` | El que inventas y pegas en la consola de Meta. |
| `META_ACCESS_TOKEN` | Token permanente de la app. |
| `META_PHONE_NUMBER_ID` | Identificador del número emisor. |
| `DEFAULT_MODEL` | Formato `proveedor:modelo`. |
| `DEBOUNCE_SECONDS` | Espera antes de responder, para agrupar ráfagas. |

### Modelos

Telar usa `init_chat_model` de LangChain, así que cualquier proveedor soportado sirve cambiando una cadena:

```
anthropic:claude-sonnet-4-5
openai:gpt-4.1
ollama:llama3.1
```

Para OpenAI u Ollama instala el extra correspondiente: `pip install "telar[openai]"`.

## Estructura

```
telar/
  core/         tipos normalizados y máquina de estados
  db/           pool y repositorios (SQL plano, sin ORM)
  channels/     adaptadores; hoy solo Meta WhatsApp
  agent/        grafo de LangGraph y herramientas
  llm/          registro de proveedores
  api/          FastAPI y webhook
  worker/       agrupación de ráfagas y pipeline
migrations/     esquema SQL
```

Dos archivos concentran las decisiones importantes:

`core/types.py` define la frontera con el mundo exterior. Si vas a agregar un canal, empieza leyendo `ChannelAdapter`.

`core/state.py` define el traspaso a humano completo. `should_bot_reply()` se consulta antes de invocar el grafo: si un asesor tiene la conversación, el mensaje se guarda pero la IA no genera nada.

## El traspaso a humano

Cuatro estados y las transiciones válidas entre ellos:

- `bot` — la IA responde.
- `pending` — se pidió un asesor, está en la cola del equipo, la IA ya calló.
- `open` — un asesor la tomó. La IA solo persiste mensajes.
- `resolved` — cerrada. El siguiente mensaje del cliente la reabre en `bot`.

El agente pide el traspaso llamando la herramienta `escalar_a_humano`. Todo lo demás lo maneja la máquina de estados, fuera del grafo, donde se puede razonar sin pensar en el LLM.

## Hoja de ruta

- [x] Gateway de WhatsApp con agente configurable
- [x] Máquina de estados del traspaso
- [ ] Bases de conocimiento con pgvector, expuestas como herramienta del agente
- [ ] Bandeja de entrada, contactos e informes
- [ ] Cuentas, equipos y roles (superadmin, administrador, supervisor, asesor)
- [ ] Herramientas configurables por HTTP y SQL
- [ ] Compilador de grafos desde JSON
- [ ] Constructor visual de flujos

El constructor visual va al final a propósito. El JSON del grafo, que se guarda en `bot_versions.graph`, es el contrato entre el editor y el runtime. Podemos compilar y probar flujos escritos a mano mucho antes de que exista un solo pixel de interfaz.

## Deuda conocida del v0

El agrupamiento de ráfagas vive en memoria del proceso. Un reinicio pierde lo que esté en vuelo. Es aceptable mientras el proyecto es de un número; cuando deje de serlo, `worker/dispatcher.py` se reemplaza por un productor a Redis Streams y nada más cambia.

No hay reintentos con backoff en el envío. `SendResult.retryable` ya distingue los errores que vale la pena reintentar; falta la política.

Los tokens de Meta se guardan como `bytea` en la tabla `inboxes` pero todavía se leen del entorno. El cifrado con Fernet está previsto, no implementado.

## Contribuir

Issues y pull requests bienvenidos. Si vas a trabajar algo de la hoja de ruta, abre un issue antes para no duplicar esfuerzo.

## Licencia

MIT.

Telar no está afiliado con Meta Platforms. WhatsApp es una marca registrada de Meta Platforms, Inc.
