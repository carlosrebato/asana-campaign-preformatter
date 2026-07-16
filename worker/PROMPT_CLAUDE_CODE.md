# Prompt para Claude Code

> Copia y pega esto en Claude Code **cuando llegue el momento de cablear**.
> Para desplegar solo la demo, ver el final del fichero.

---

## Para CABLEAR lo real

Antes de lanzarlo, ten a mano:
- El proyecto de Asana creado + su GID
- El campo Tipología (Growth/Value) creado en ese proyecto
- API key de Anthropic
- Personal Access Token de Asana
- El Excel real del mes y el documento de estrategia del mes

---

Te paso el proyecto `campaign-loader`: un prototipo con la UI completa y datos mock.

**Lee `DECISIONES.md` primero.** Explica el porqué de cada decisión de diseño y
qué está pendiente. Luego `README.md` para la arquitectura, y
`prompts/interpretacion.md`, que **es** el prompt del LLM.

**Tu trabajo: cablear lo real sin tocar la UI.** La UI está validada. No la
rediseñes; si algo del cableado lo exige, avísame antes.

### Configuración
- Proyecto Asana destino (GID): `[RELLENAR]`
- API key de Anthropic → secret, nunca en el código
- Asana PAT → secret, nunca en el código

### PASO 0 · Inspeccionar Asana. Para y espera mi OK.

Antes de escribir nada, lee el proyecto real por API y sácame:
- GIDs de todas las secciones
- GIDs de cada custom field y **de cada opción enum**

**Crítico:** los enum de Asana se escriben por GID de opción, no por texto.
`"MiMovistar"` no vale. Genera el mapa `{texto → gid}`.

Si algún valor de `data.js` no existe en el proyecto real, **dímelo antes de
continuar**. No lo inventes ni lo mapees por aproximación.

Actualiza `data.js` con los valores reales.

**Enséñame el mapeo y los desajustes. No sigas sin mi confirmación.**

### PASO 1 · Backend

Añade `src/index.js` y activa `main` en `wrangler.toml`:

- `POST /api/inspeccionar` — metadatos del fichero (nº filas, PACs). Feedback
  inmediato **antes** de gastar una llamada al LLM.
- `POST /api/interpretar` — ambos ficheros → LLM → `Tarea[]`
- `POST /api/duplicados` — PACs → cuáles ya existen en Asana
- `POST /api/cargar` — tareas aprobadas → crear en Asana

### PASO 2 · Interpretación

Usa `prompts/interpretacion.md` **tal cual** como system prompt. Cárgalo como
fichero, no lo copies dentro del código: quiero poder editarlo sin tocar el
Worker.

Modelo: `claude-sonnet-4-6` vía API de Anthropic.

Aísla la llamada tras `interpretarDocumentos(excel, estrategia) → Tarea[]`.
**Nada del resto del código debe saber qué LLM hay detrás** — migraremos a Azure
OpenAI o Copilot y quiero tocar solo esa función.

**El PDF no puede romper la carga.** Si viene ilegible, vacío o sin contexto
útil: devuelve las tareas del Excel sin contexto, sin avisar de nada. Silencio.

**Parseo del Excel:** te adjunto el real. Estructura conocida: cabeceras en la
fila 2, una fila por envío/pieza, varias filas por PAC. Hazlo tolerante a
variaciones y dime qué estructura mínima necesitas para ser fiable.

### PASO 3 · Carga en Asana

- **Idempotencia por PAC.** Va al principio del nombre. Comprobar antes de crear.
- **Búsqueda dirigida por PAC.** Nunca traer todas las tareas (hay miles).
- Sección destino según `productSectionMap`.
- Estado inicial: `CATALOGS.estadoInicial`.
- **Carga parcial:** si falla alguna, devolver cuáles y por qué. La UI ya tiene
  esa pantalla.

### Restricciones

- **Sin build step.** HTML/CSS/JS estático servido por el Worker. Nada de React,
  bundlers ni dependencias de frontend.
- Sin base de datos. Sin login.
- Secretos vía `wrangler secret`. Jamás en el código ni en `wrangler.toml`.
- Mantén los mocks tras un flag (`?mock=1`) para poder demostrar aunque la API falle.
- **No atar lógica de negocio a Cloudflare** — esto migra a Azure Functions.

### Orden de trabajo

1. Inspecciona Asana → enséñame GIDs y desajustes. **Para.**
2. Backend + interpretación. Prueba con los documentos reales.
3. Carga en Asana. **Prueba con 1-2 tareas primero, no con todas.**
4. Verifica que cargar dos veces no duplica.

**Empieza por el paso 1 y no sigas sin mi confirmación.**

---

## Para solo DESPLEGAR LA DEMO

Te paso `campaign-loader`: prototipo de UI con datos mock. Lee `README.md`.

**Esto es solo para una demo.** No hay que cablear nada — ni IA, ni Asana, ni
API keys. Los mocks se quedan.

Necesito:

1. **Desplegarlo en Cloudflare Workers** y darme la URL. Es estático, sin build
   step; `wrangler.toml` ya está configurado con `[assets]`.
2. **Poner `simulateFailures` a `0`** en `public/api.js` (está en 2 para simular
   fallos; en la demo quiero la carga toda verde).
3. **Probar el flujo completo** en la URL antes de dármela: clic en las dos zonas
   de carga → Procesar → revisión → editar un campo → cambiar un producto (debe
   recolocar la tarjeta) → arrastrar una tarjeta a otra sección → aprobar sección
   → Cargar en Asana → confirmar → resultado. Sin errores en consola.
4. **Comprobar que las fuentes Movistar cargan** en el dominio desplegado (están
   en `public/fonts/`, referenciadas desde `colors_and_type.css`).

Restricciones: no rediseñes la UI, no añadas dependencias, no metas llamadas
reales a nada. Si encuentras un bug en el flujo, arréglalo.
