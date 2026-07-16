# Campaign Loader · Movistar

Puente entre la planificación mensual de campañas (Excel de Comercialización)
y Asana, con el contexto de mensaje pegado a cada tarea.

> **Lee `DECISIONES.md` antes de tocar nada.** Explica el porqué de cada decisión
> de diseño. El código se reescribe; el razonamiento no está en el código.

## Estado actual

UI completa y navegable. **Los datos son de ejemplo** — no hay llamadas a IA ni
a Asana todavía. Sirve para validar el flujo antes de cablear.

**Antes de una demo:** poner `simulateFailures` a `0` en `public/api.js`.

## Desplegar

```bash
npx wrangler deploy
```

Sin build step, sin dependencias. Todo es HTML/CSS/JS estático.

## Probar en local

```bash
npx wrangler dev
# o:
cd public && python3 -m http.server 8080
```

## Estructura

```
DECISIONES.md              ← El porqué. Empieza aquí.
PROMPT_CLAUDE_CODE.md      ← Prompt listo para cablear lo real o desplegar la demo.
prompts/
  interpretacion.md        ← El prompt maestro del LLM. Se edita aquí, no en código.
public/
  index.html               App completa (vistas + eventos + estado)
  app.css                  Estilos sobre el design system Movistar
  colors_and_type.css      Design system oficial (no tocar)
  fonts/                   Movistar Sans + Movistar (no tocar)
  data.js                  ← Catálogos y datos de ejemplo
  api.js                   ← CAPA DE API. Aquí se cablea todo.
```

## Cómo cablear lo real

**Solo hay que tocar `api.js`** (frontend) y añadir un handler en el Worker.
La UI no sabe qué hay detrás.

| Función | Qué debe hacer la versión real |
|---|---|
| `interpretarDocumentos()` | POST al Worker → LLM con `prompts/interpretacion.md` → `Tarea[]` |
| `inspeccionarFichero()` | Leer cabeceras del Excel (nº filas, PACs) |
| `comprobarDuplicados()` | Buscar PACs existentes en Asana (búsqueda dirigida) |
| `cargarEnAsana()` | Crear tareas vía MCP Asana / API REST |

### Reglas que no se negocian

1. **El Excel es la fuente de verdad.** Todos los campos salen de él. El PDF
   nunca escribe en un campo.
2. **Del PDF solo sale "cómo lo contamos"**: claim, argumento, tono. Nada de
   fechas, canales ni segmentaciones — ya están en el Excel.
3. **Umbral alto de vinculación.** Ante la duda, no vincular. Prefiere no
   encontrar a encontrar mal.
4. **El PDF no puede romper la carga.** Si viene ilegible o vacío, las tareas
   se cargan sin contexto. Y no se avisa de nada.

Detalle completo en `DECISIONES.md` y `prompts/interpretacion.md`.

### Semáforo

Mide **la vinculación con el PDF**, no la fiabilidad del dato:

- 🟢 contexto encontrado, vinculación clara
- 🟡 contexto encontrado, vinculación dudosa — revisar
- (sin bola) sin contexto — tarea limpia del Excel

### Idempotencia

La clave es el **PAC**, al principio del nombre de la tarea.
Antes de crear, comprobar si ya existe. Búsqueda **dirigida por PAC** — nunca
traer todas las tareas del proyecto (los reales tienen miles).

### Migración a Azure OpenAI / Copilot

La llamada al LLM está aislada tras `interpretarDocumentos()`. Migrar = reescribir
esa función y el prompt. El resto no se toca. **No atar lógica de negocio a
Cloudflare.**

## Configuración

En `data.js` → `CATALOGS`: secciones, catálogos de campos, `productSectionMap`
(producto → sección, determinista), `estadoInicial`, `asanaProject`.

**Los valores actuales son de referencia.** Al cablear hay que leer el proyecto
real de Asana e importar los GIDs. Los enum de Asana se escriben **por GID de
opción, no por texto**.

## Pendiente antes de cablear

- **Qué es una tarea de Asana** (1 PAC vs 1 fila vs 1 TSK) — bloquea la carga.
  Ver `DECISIONES.md`.
- Crear el campo Tipología (Growth/Value) en el proyecto nuevo.
- Acordar el set de estados con Comercialización.
