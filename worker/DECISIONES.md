# Decisiones de diseño

> **Léeme antes de cambiar nada.** Cada decisión responde a un problema real y
> concreto. El código se puede reescribir; el razonamiento costó tiempo y
> contexto que no está en el repo.

---

## El problema que resuelve la herramienta

Comercialización planifica las campañas del mes. Ese trabajo llega en dos
formatos: un **Excel** con los datos operativos (código PAC, fechas, producto,
medio, segmento, volumen) y un **documento de estrategia** con el contexto de
mensaje. El equipo de producción trabaja en **Asana**, y hoy la carga se hace
a mano, campaña por campaña, vía formulario.

Campaign Loader es el puente: **Excel → Asana**, con el contexto de mensaje
pegado a cada tarea.

### Por qué no volcar directo a Asana y corregir allí

Es la pregunta obvia y tiene respuesta:

- **Un error en producción es caro.** El proyecto de Asana lo ven muchas
  personas. Meter tareas mal formadas, duplicadas o en la sección equivocada
  ensucia el sistema de todos y cuesta más limpiarlo que revisarlo antes.
- **La revisión previa preserva la incertidumbre de la IA.** Una vez cargada en
  Asana, una tarea dudosa parece igual de fiable que una buena. En el Loader,
  el semáforo dice cuál mirar. Ese contexto se pierde al cargar.
- **El valor es la pureza de la ingesta.** Durante el mes se retocarán cosas en
  Asana — pero menos y con menos calado si lo que entró estaba limpio.

Asana edita tareas mejor que cualquier UI que construyamos. **El Loader no
compite con Asana en edición: es un filtro de calidad previo.**

---

## Las tres reglas que sostienen todo

### 1. El Excel es la fuente de verdad. Siempre.

Todos los campos estructurados salen del Excel y solo del Excel. Los datos del
Excel son fiables **por definición** — si vienen mal, es un problema de
Comercialización, no de la herramienta.

El PDF **nunca** escribe en un campo. Ni aunque el Excel deje algo vacío.

### 2. Del PDF solo sale "cómo lo contamos"

El documento de estrategia solo puede aportar **contexto de mensaje**: claim,
argumento de venta, tono, reason why. Lo que ayuda a alguien a *escribir* la
pieza.

Todo lo demás se descarta: fechas, canales, segmentaciones (ya están en el
Excel), y priorizaciones, riesgos y recomendaciones de planificación (no son
asunto de la tarea).

**El criterio no es de calidad, es de registro.** No se le pide al modelo que
juzgue si algo es bueno — es imposible, porque el ruido generado con IA suena
plausible. Se le pide que distinga si una frase **le habla al cliente** (entra)
o **le habla a un colega sobre la campaña** (fuera). Esa distinción sobrevive
a cualquier cambio de formato.

### 3. Umbral alto de vinculación, silencio por defecto

Excel y PDF **no comparten identificador**: el PDF no tiene PACs. El
emparejamiento es por producto y contexto, y por tanto es inferencia.

- Vincula solo si es inequívoco.
- Falso negativo (no encontrar algo que existía) → coste cero.
- Falso positivo (pegar el mensaje equivocado) → confunde a producción.
- **Prefiere no encontrar a encontrar mal.**

---

## El semáforo mide la VINCULACIÓN, no el dato

🟢 contexto encontrado y vinculación clara
🟡 hay contexto pero la vinculación es dudosa — revisar
(sin bola) no hay contexto — tarea limpia del Excel

**No mide la fiabilidad del dato.** El dato del Excel es fiable por definición
(ver regla 1). Si se mezclan las dos señales en un solo color, se pierden ambas.

Consecuencia útil: **aprobar en lote es barato.** Las tareas sin bola no hay
ni que mirarlas.

---

## El PDF no puede romper la carga

**Esta es la decisión clave del diseño.**

Los dos ficheros se suben siempre. Pero el contenido del PDF es **opcional**:
si viene ilegible, vacío o sin nada de mensaje, la herramienta carga las tareas
del Excel sin contexto y sigue funcionando.

**Y no avisa de nada.** Sin banner, sin "no he podido extraer contexto", sin
nota. Las tareas simplemente salen sin bola, que es un estado normal de todos
modos. Desde la UI, "el PDF no mencionaba esta campaña" y "el PDF era ilegible"
se ven igual.

Esto es deliberado. El documento de estrategia viaja en el flujo y se procesa
siempre; que no aporte nada un mes concreto no debe generar ruido ni conversación.

---

## La llamada al LLM va aislada

Toda la interpretación vive tras `interpretarDocumentos(excel, estrategia)`.
El resto del código **no sabe ni debe saber** qué modelo hay detrás.

Razón: el destino es infraestructura corporativa (Azure OpenAI o Copilot dentro
del tenant), no una API externa con clave personal. Cuando llegue ese momento,
se reescribe esa función y su prompt, y nada más.

El prototipo en Cloudflare Worker es el **envoltorio desechable**. La lógica y
la UI son lo permanente. No atar nada específico de Cloudflare a la lógica de
negocio.

---

## Sobre los documentos de origen (contexto que no se deduce del código)

El documento de estrategia que llega **no es homogéneo ni estable**. En la
práctica contiene mezcladas al menos tres cosas:

1. **Material original de Comercialización** (Growth / Value / Dispositivos):
   plantilla fija con elevator pitch, mensaje principal, mensaje secundario,
   reason why, tono y target. **Esto es lo valioso.** Es lo mismo que produce
   el Excel, en otro formato.
2. **Comentarios de planificación** sobre ese material: "ok a planificación",
   "pocos cambios a lo propuesto". Sin valor para producción.
3. **Output de procesado con IA**: lecturas ejecutivas, priorizaciones,
   arquitecturas, riesgos, "qué haría diferente". Registro de planner. Aporta
   opinión sobre el plan, no mensaje. Y cuando aporta mensaje, es un resumen
   degradado de lo que ya está en (1).

**El formato cambia cada mes.** Por eso el filtro es por registro y no por
estructura: cualquier regla basada en maquetación, colores o posición de slides
se rompe al mes siguiente.

**Objetivo real del sistema:** recuperar el brief de mensaje que Comercialización
ya escribió y ponerlo en la tarea de quien tiene que producir la pieza. Hoy ese
brief se pierde entre decenas de páginas que producción no lee.

---

## Lo que sabemos del Excel real

Primer fichero real: `fixtures/ASANA_FICHERO_CARGA_2026-09-21.xlsx`
(90 filas, 21-sep → 31-oct 2026). Todo lo de abajo sale de ahí.
Mapeo de columnas y valores en `data.js → EXCEL`.

### 1 fila = 1 tarea

90 filas, 90 PACs distintos. **El PAC ya es la pieza** (el SMS, el email,
la carta), no la campaña multi-medio. Las opciones A/B/C que se barajaban
se resuelven solas: **1 fila = 1 tarea, sin subtareas.**

Pendiente de confirmar con Comercialización que siempre es así. Si un mes
un PAC se repite en varias filas, se agrupa y las filas pasan a subtareas
(opción A). No hace falta decidirlo ahora.

El TSK no vale como clave: más de la mitad vienen como `TSKPDTE`
(pendiente de asignar).

### No es "el mes": es un volcado que se repite

El fichero cubre seis semanas y tiene una columna `FECHA GRABACION EN
FICHERO ASANA` con la misma fecha en todas las filas. La próxima entrega
traerá PACs que ya cargamos, algunos con `VIABILIDAD` cambiada de
`Planificada` a `Aprobada`.

Consecuencia: la herramienta **sincroniza**, no carga. Por cada PAC:

- No existe en Asana → crear.
- Existe → por ahora, no tocar. Actualizar estado es fase 2.

La idempotencia por PAC deja de ser un aviso y pasa a ser el núcleo.

### Growth / Value / Servicing sale de PALANCA

El Excel no trae tipología. Se deduce de `PALANCA`:

| PALANCA | Tipología |
|---|---|
| Desarrollo | Growth |
| Captación No Cliente | Growth |
| Fidelización/Dinamización | Value |
| Legal | Servicing |

Regla interna, pendiente de que Comercialización la bendiga. Está en un
solo sitio (`EXCEL.palancaTypology`).

### Catálogos: usamos los valores que aparecen

Los desplegables del Excel apuntan a una hoja de listas que no viene en la
copia. En vez de esperarla, los mapeos de `data.js` se han hecho con los
valores que salen en el fichero (7 medios, 18 productos, 4 palancas). Si un
mes aparece uno nuevo, el parser lo tiene que avisar y se añade a mano.

### Suciedad conocida del fichero

El parser tiene que aguantar esto sin romperse:

- **El PAC (col. B) es una fórmula** `=MID(E;1;8)`: se saca del nombre.
  Validar con `EXCEL.pacPattern` sobre el nombre, no fiarse de B.
- **Fechas como texto**: `'21-sep.-2026'` (mes español abreviado con punto)
  y `'21/9/26'`. Hay que parsearlas.
- **PO ESTIMADO no se puede leer**: mezcla `50`, `2.2`, `'3.380.000'`,
  `'PTE'` y `0`. Probablemente en miles, sin confirmar. Se lleva como texto
  y no se usa para nada.
- Espacios sobrantes en valores (`'SMS '`, `'TSK32255 '`). Normalizar.
- `NOMBRE DE LA TAREA` (col. J) a veces es `0` o vacío. El nombre de la
  tarea de Asana es la col. E, que siempre viene y ya lleva el PAC delante.
- **La mitad derecha (Q–AF) viene vacía.** Parecen columnas del formulario
  antiguo de Asana. Se ignoran. Pendiente de preguntar si sobran.
- **Tipo de cliente no viene.** Por la regla 1, se queda vacío.

---

## Otros pendientes

- **Estado inicial de las tareas.** Hoy es un placeholder (`CATALOGS.estadoInicial`).
  El set definitivo se acuerda con Comercialización cuando el proyecto se amplíe
  a ambos equipos. Configurable en un solo sitio, precisamente porque va a cambiar.
- **Tipología (Growth/Value/Servicing).** El campo no existe en el Asana
  actual. Hay que crearlo en el proyecto nuevo.
- **Catálogos reales.** Los valores de `data.js` son de referencia. Al cablear,
  hay que leer el proyecto de Asana e importar los GIDs reales — los enum de
  Asana se escriben **por GID de opción, no por texto**.
- **Columna puente.** El arreglo de fondo al problema de vinculación no es
  técnico: sería que el Excel llevara una columna con el territorio de la
  estrategia, o que la estrategia llevara el PAC. Cuesta cero técnicamente y
  dispara la fiabilidad. Es conversación de proceso.

---

## Sobre la demo

El prototipo actual usa **datos de ejemplo**. No hay llamadas a IA ni a Asana.

Antes de enseñarlo: poner `simulateFailures` a `0` en `api.js` (está en `2` para
poder ver el reporte de carga parcial).

**Al presentarlo, decir siempre:** *"el flujo es este, los datos son de ejemplo,
la carga real está por cablear"*. Si alguien sale de la reunión creyendo que ya
funciona, se genera una expectativa imposible de sostener.
