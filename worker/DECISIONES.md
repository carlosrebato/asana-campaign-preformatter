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

## PENDIENTE · Bloquea la carga real

### ¿Qué es una tarea de Asana?

**Sin resolver esto no se puede cablear la carga.** No es un detalle de pulido.

En el Excel, **una campaña son varias filas**. Cada fila es un envío/pieza:
mismo PAC, distinto medio (Email / SMS / Banners M+) o distinto segmento con
distinto volumen. Un PAC puede tener 3 filas o 12.

Hay además una columna `TAREA CAMPAÑA (TSK)` con el identificador de pieza de
Ártica — pero no todas las filas lo tienen (los banners traen `NA`).

Opciones:

- **A · 1 PAC = 1 tarea.** Las filas se agrupan; los medios podrían ser
  subtareas. Encaja con la convención de nombres actual
  (`PAC34890_eSimFLAG_Resto clientes_Jul y Ago`). Pierde granular por pieza.
- **B · 1 fila = 1 tarea.** Máximo granular. Pero 12 tareas casi idénticas para
  un mismo PAC es ruido.
- **C · 1 TSK = 1 tarea.** El TSK es el identificador de pieza real, pero no
  todas las filas lo tienen.

**Decisión de equipo, no unilateral.** Se valida con la demo.

Nota: si se va a A, el Excel ya da gratis las subtareas — si un PAC tiene 3
filas (Email, SMS, Banners), esas son sus 3 subtareas. No hace falta inventar
plantillas fijas: el propio Excel dice qué piezas lleva cada campaña.

---

## Otros pendientes

- **Estado inicial de las tareas.** Hoy es un placeholder (`CATALOGS.estadoInicial`).
  El set definitivo se acuerda con Comercialización cuando el proyecto se amplíe
  a ambos equipos. Configurable en un solo sitio, precisamente porque va a cambiar.
- **Tipología (Growth/Value).** El campo no existe en el Asana actual. Hay que
  crearlo en el proyecto nuevo.
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
