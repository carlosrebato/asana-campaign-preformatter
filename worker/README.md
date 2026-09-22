# Campaign Loader · Movistar

Puente entre la planificación mensual de campañas (Excel de Comercialización)
y Asana, con el contexto de mensaje pegado a cada tarea.

> **Lee `DECISIONES.md` antes de tocar nada.** Explica el porqué de cada decisión
> de diseño. El código se reescribe; el razonamiento no está en el código.

## Estado actual

UI completa y navegable. **Los dos documentos se leen de verdad**, en el
navegador y sin IA: el Excel pone los campos de cada tarea y el documento de
estrategia pega el brief de mensaje que escribió Comercialización. Lo único
que falta es la carga en Asana.

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
fixtures/
  ASANA_FICHERO_CARGA_*.xlsx  Excel real de Comercialización, para probar el parser
public/
  index.html               App completa (vistas + eventos + estado)
  excel.js                 Lector del Excel de Comercialización → Tarea[] + avisos
  estrategia.js            Lector del documento de estrategia → briefs de mensaje
  vendor/                  SheetJS (.xlsx) y pdf.js (.pdf)
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
| `interpretarDocumentos()` | **Hecho** sin IA: cruza Excel y briefs. El LLM solo hará falta si un producto tiene varios briefs y hay que elegir |
| `inspeccionarFichero()` | **Hecho** para los dos ficheros (`excel.js`, `estrategia.js`) |
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

En `data.js` → `EXCEL`: columnas del fichero de Comercialización y tablas de
mapeo a Asana (medio → formato, producto → producto, palanca → tipología).

**Los valores actuales son de referencia.** Al cablear hay que leer el proyecto
real de Asana e importar los GIDs. Los enum de Asana se escriben **por GID de
opción, no por texto**.

## Pendiente antes de cablear

- Confirmar con Comercialización que **1 fila = 1 PAC** siempre (así viene en
  el primer fichero real; ver `DECISIONES.md`).
- Crear el campo Tipología (Growth/Value/Servicing) en el proyecto nuevo.
- Acordar el set de estados con Comercialización.
