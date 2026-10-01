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

### El brief se reconoce por etiquetas, no por maquetación

El documento de octubre trae los 12 briefs de Comercialización en **tres
formatos distintos dentro del mismo PDF**: unos numerados (5.1, 5.2…), otros
con viñetas bajo "5. Elevator Pitch", otros en prosa. Confirma lo que ya
suponíamos: cualquier regla basada en layout se rompe a la siguiente entrega.

`estrategia.js` busca **etiquetas** — idea fuerza, elevator pitch, mensaje,
jerarquía, tono, reason why — y corta en target, objetivo de negocio,
contexto, hitos y planificación. Los tres formatos caen igual.

**El texto se copia literal.** Nadie lo resume ni lo reescribe: el objetivo
es recuperar el brief que Comercialización ya escribió, no producir uno
nuevo. Esto además quita a la IA del camino crítico.

Con el fichero de octubre: 44 de 73 tareas reciben contexto (60%). Las 29
restantes son R2R, enews, Marca e Info — envíos recurrentes sin campaña
detrás, que **deben** salir sin bola.

### La estrategia llega en varios documentos, no en uno

Octubre llegó repartido: `Planes Comerciales Growth y Value` (Comercialización)
y `Estrategia de Comunicación` (Dispositivos). La herramienta acepta los que
hagan falta y junta los briefs de todos. Ninguno es obligatorio por separado.

Y el de Dispositivos enseña el caso que había que probar: **no usa la
plantilla de Comercialización**. Son cuotas de mercado, fases de calendario y
prioridades por categoría — registro de colega, no de cliente. El lector
encuentra cero briefs, no pega nada y no avisa. Las diez tareas de R2R salen
sin bola, que es lo correcto.

El arreglo no es técnico: es que Dispositivos rellene la plantilla. Mientras
no lo haga, ningún parche de código puede inventar un mensaje que nadie ha
escrito.

### La vinculación es una tabla, no una inferencia

`EXCEL.productoBrief` mapea producto → título del brief. Explícita a
propósito: vincular por parecido es justo lo que prohíbe la regla 3. Un
producto sin entrada sale sin contexto, que es el caso normal.

Aquí es donde entraría un modelo el día que un producto tenga varios briefs
y haya que elegir por fecha o colectivo. Hoy no pasa. Mientras no pase, no
hace falta IA en ningún punto del flujo.

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

## Un campo rechazado no tumba la tarea

Asana puede rechazar un valor que su propio catálogo lista: los Tipos de
tarea restringen qué opciones valen, y eso no se ve hasta que se escribe.
Pasó con `Pdte Comercialización` en la primera carga real, y tiró las tres
tareas.

La carga reintenta sin campos personalizados y avisa en el reporte. Mismo
principio que con el documento de estrategia: **lo accesorio no puede
romper lo principal**. Vale más una tarea con un campo vacío que una
campaña que no llega a producción.

No se puede quitar solo el campo culpable: Asana devuelve las opciones que
acepta, pero no dice de qué campo habla, y los valores de los demás campos
tampoco están en esa lista. Se intentó y se descartó.

## Los catálogos se leen de Asana, no se copian

Los enum de Asana se escriben por GID de opción. La tentación es copiar
esos GIDs al código; es un error: en cuanto alguien añade una opción en
Asana, la copia miente y nadie se entera.

`/api/catalogos` lee el proyecto al arrancar y trae secciones, campos y
opciones con sus GIDs. Lo que hay en `data.js` es **una copia de
seguridad** para que la app arranque sin backend, marcada con `esCopia`.
Cuando está activa, la entrada avisa: se puede revisar, no cargar.

Lo que **no** puede venir de Asana es el mapeo del Excel: que `Fútbol+`
sea `M+ Futbol`, o que `Helios` no tenga producto propio y vaya a `Otros`.
Eso es una decisión de negocio y vive en `EXCEL`. **Está sin validar con
Comercialización**, y es lo primero que hay que enseñarles.

## Lo que el proyecto real enseñó

Leyendo `BTL - Run ✉️` (2.594 tareas) aparecieron cosas que habíamos
supuesto mal:

- **Horecas tiene sección propia** (`🏨🍽️🍀HORECAS/LLPP`), y también
  `💙ENEWS MARCA` y `📽️⚾ Enews Entretenimiento M+`. Se había decidido que
  Horecas no era sección; el proyecto dice que sí.
- **`Notificación Push` existe como formato**, así que `App Mi Movistar`
  ya no necesita el apaño de mandarlo a Customer Journey.
- **`VIABILIDAD` no tiene equivalente.** El campo Estado tiene 26 opciones
  de producción (Pdte creatividad, Pdte Estudio…) y ninguna es
  Aprobada/Planificada. Todas las tareas nacen en `estadoInicial`.
- **Growth/Value/Servicing sigue sin existir.** Se calcula y se enseña en
  la revisión, pero al crear la tarea no se escribe en ningún sitio.

### Duplicar el proyecto NO conserva todos los GIDs

Al duplicar `BTL - Run ✉️` para hacer el sandbox, Asana se comportó de dos
maneras distintas con los campos:

| Campo | En el duplicado |
|---|---|
| Producto, Estado | **mismo GID** — son campos del espacio de trabajo |
| Tipo de cliente, Formatos de comunicación, Peticionario | **GID nuevo** — copia local del proyecto |

Los nombres y las opciones son idénticos; los identificadores, no. Un
código con los GIDs escritos a mano habría intentado escribir en campos
que no existen en ese proyecto.

Es la prueba de por qué los catálogos se leen en caliente y se buscan
**por nombre de campo** (`CATALOGS.fieldNames`), no por GID.

## El contexto no es un dato del Excel

Cuando llega un Excel corregido —y llega, porque en esta casa el fichero
se vuelve a mandar— la propuesta se actualiza en vez de empezar de cero.
La primera versión de eso comparaba tarea a tarea, incluido el contexto,
y marcaba como "cambiada" cualquiera cuya descripción fuera distinta.

Probado con dos Excel reales (73 campañas y 69), el resultado fue:

- **2** campañas habían cambiado de verdad (una fecha de entrega)
- **45** se marcaron como cambiadas, y perdieron su aprobación
- lo escrito a mano por una persona se borró sin avisar

La diferencia no venía del Excel: venía de que se releían los mismos tres
documentos y el modelo, leyéndolos otra vez, no devolvía exactamente lo
mismo. Cuatro minutos de espera para empeorar el resultado.

La regla, entonces:

> El Excel dice **qué campañas hay y con qué datos**. El contexto se
> deduce de los documentos. Si los documentos no han cambiado, el
> contexto tampoco, y no se vuelve a calcular.

En la práctica:

- los briefs que saca el modelo se guardan **con la propuesta**
- dos documentos son el mismo si coinciden nombre y tamaño
- si lo son, solo se busca contexto para los PAC que no estaban antes
- una descripción **editada a mano** (`editada`) no la pisa ninguna pasada
- con eso, la segunda pasada bajó de 4 min 15 s a **37 s**, y de 45
  aprobaciones perdidas a 2 (las que cambiaron de verdad)

Si los documentos **sí** cambian, es otro mes: se relee todo y se
re-empareja todo. Ahí perder las aprobaciones es lo correcto, porque el
contexto que se aprobó ya no es el que hay.

## Si algo se rompe, se dice

El fallo que destapó todo esto fue que `API.guardarPropuesta` no existía:
se llamaba desde el procesado y nunca se había escrito. La actualización
no se guardaba nunca, y el enlace compartido seguía enseñando lo viejo.

Lo grave no era el fallo, era cómo se veía: la pantalla de progreso se
quedaba con la barra llena y el reloj corriendo, para siempre. El error
solo estaba en la consola, y quien usa esto no abre la consola.

Ahora el procesado tiene su pantalla de error, con el motivo y un botón
de reintentar. Y `guardarPropuesta` **lanza error** en vez de devolver
`null` como sus vecinas: guardar los cambios de todo un equipo no es algo
que pueda fallar en silencio.

## Los productos se cierran en origen, no se adivinan

Cuando el Excel trae un PRODUCTO / KPI que la tabla de `data.js` no
conoce (`Champions`, `Prepago`, `Movistar Plus+ (OTT)`, `Migración
Tecnológica`), la tarea sale con producto `Otros`. Se avisa al subir el
fichero, pero el aviso no viaja con la tarea: llega a Asana con el
producto equivocado y, probablemente, en la sección equivocada.

Hay dos arreglos posibles y se ha elegido el lento a propósito
(29-sep-2026):

1. **Que lo dirima el modelo.** La ruta `/api/productos` ya existe y no
   está enchufada. Acertaría casi siempre: Champions es fútbol y lo
   sabe cualquiera.
2. **Que Comercialización cierre la lista**, igual que se cerró la de
   medios.

Se espera a 2. La razón no es técnica: adivinar bien tapa el problema en
vez de resolverlo, y el mes siguiente aparece otro valor nuevo. Cerrar la
lista lo corta de raíz y además obliga a la conversación que hace falta.

Ojo con un detalle que confunde: **`Otros` es una categoría legítima de
Asana**. `Marca`, `Info`, `Helios`, `Renting coche eléctrico` y
`eSIMFlag` apuntan ahí a propósito. Un `Otros` decidido y un `Otros` por
defecto salen hoy como la misma cadena y no se distinguen mirando la
tarea. Lo que los separa es si alguien lo escribió alguna vez en la
tabla. Si algún día hace falta distinguirlos en pantalla, el aviso del
lector ya lleva el valor exacto del Excel: basta con que acompañe a la
tarea hasta la revisión.

## Los banners: el dato es el color de la celda

El mes llega en dos Excel que no se parecen. El de Comercialización es
una tabla —1 fila = 1 campaña— y el dato está escrito. El de banners de
Movistar Plus+ es una parrilla: las filas son posiciones del menú, las
columnas son semanas, y **lo que dice si hay tarea o no es el color de
la celda**. Verde es una creatividad nueva, que hay que producir; blanco
es una que se reutiliza y no pide nada a nadie.

Por eso son dos lectores (`excel.js` y `banners.js`) y no uno con un
`if`. Comparten la forma de salida —`Tarea[]` más avisos— y nada más.

**El verde no es un verde.** En el fichero de octubre hay tres tonos
distintos (`#DAF2D0`, `#DCEDD5`, `#D1E1D3`), porque cada quien pinta con
el suyo y Excel guarda unos como rgb y otros como índice del tema del
libro más un matiz. La primera versión comparaba contra una lista de
colores y salían 39 tareas en vez de 42. Ahora se resuelve el color
final —tema y matiz incluidos— y se pregunta por el **tono**: ¿esto es
un verde? Da igual cuál.

Lo que no es ni verde ni blanco no se adivina: se avisa. Una celda con
texto y sin pintar, o pintada de un color que nadie ha explicado, sale
como aviso al subir el fichero y no se convierte en tarea. Preferimos
que falte una tarea y se sepa, a que aparezca una que nadie pidió.

**La fecha no está en el fichero.** El Excel dice qué semana se publica
cada pieza; la fecha que va a Asana es la de entrega al Plus, que son
n-3 días **laborables** antes (Bárbara y Eduardo, 30-sep-2026). Se
calcula, y por eso la tarea escribe en sus notas el día que publica y de
dónde sale la cuenta: una fecha calculada que no se puede comprobar es
una fecha en la que nadie confía.

Los festivos están en `BANNERS.festivos` y **están incompletos a
propósito**: son los nacionales de España. Los autonómicos y locales de
Madrid no están porque nadie los ha confirmado. En octubre de 2026 no
cambia nada —el único festivo del mes es el 12, que es nacional— pero en
diciembre o en mayo sí cambiaría. Está pendiente cerrarlo.

**Los banners no pasan por el modelo.** No hay nada que deducir: la
celda dice de qué es la pieza. Así que un mes de solo banners no cuesta
ni una llamada ni un minuto de espera, y funciona sin documentos de
estrategia. Cruzarlos algún día con el índice del mes es posible, pero
hoy no hace falta y no se paga por si acaso.

**El identificador de un banner es su celda** (`BAN-K3`). No tiene PAC y
no puede tenerlo. Que la identidad sea la coordenada es lo que hace que
la segunda pasada funcione: cambiar el texto de una celda sale como
"ha cambiado" y no como una tarea que desaparece y otra que nace.

Cuando dos celdas dan la misma tarea —en octubre pasa dos veces, porque
la hoja tiene bloques repetidos— salen las dos y se avisa. Decidir cuál
sobra es de Comercialización, no del lector.

## El peticionario es un correo, y los correos se miran, no se deducen

El Excel trae `INES MOLINERO MARTIN`, en mayúsculas. Las tareas que ya
existen en el Asana de producción no guardan un nombre: guardan
`ines.molineromartin@telefonica.com`.

Hubo una versión de esto que montaba el correo a partir del nombre
—nombres pegados, punto, apellidos pegados, sin acentos— contando dos
apellidos desde el final y pegando las partículas al apellido que
acompañan, para que `MARTA MARIN DE LAS HERAS` diera
`marta.marindelasheras`. Acertaba nueve de cada diez.

La décima era María Carla Sanz Esteban, que firma `carla.sanzesteban` y
no `mariacarla.sanzesteban`. No es una convención de Telefónica que se
nos escapara: es cómo se llama ella, y no hay regla que saque eso.

Una de cada diez equivocada son tareas que le llegan a quien no es. Así
que la regla se borró entera y en su sitio hay una lista, en
`data.js → correosConocidos`, con los correos que Carlos comprobó en el
directorio el 1-oct-2026. Es la misma decisión que con los productos:
**se cierra en origen, no se adivina.**

Quien no esté en la lista sale **sin peticionario** y con un aviso que
dice su nombre. Dos cosas que se descartaron a propósito:

- Escribir el nombre en el campo. Dejaría un campo de correos lleno de
  cosas que no son correos, y al mirar la tarea nadie sabría si eso es
  un dato o un resto.
- Calcularlo igualmente y marcarlo como dudoso. Nadie mira los avisos de
  una tarea que ya tiene el campo relleno.

Octubre lo estrenó: **Arancha Ortiz Torres** firma `PAC37421` y no está
en la lista. Su tarea sale sin peticionario y el lector la nombra al
subir el fichero. Cuando se confirme su correo, se añade una línea.

## Lo que ya está en Asana se le pregunta a Asana

Antes de esto, el botón de cargar mandaba todo lo aprobado. Mirase o no
si ya existía. Así que cargar, cerrar, abrir el enlace al día siguiente
y volver a pulsar creaba el mes entero por segunda vez. Nada lo impedía,
ni en la página ni en el Worker.

La tentación era llevar un registro: apuntar qué se creó y qué falló, y
fiarse de él. **Un registro miente.** Si Asana crea la tarea y se pierde
la respuesta —un corte, un 500 después de escribir— nosotros apuntamos
"falló" y al reintentar duplicamos. La única fuente fiable de qué hay en
Asana es Asana.

Y la consulta ya existía: es el paso de duplicados, que buscaba cada PAC
en el proyecto. Lo que pasaba es que su resultado **se tiraba**. Setenta
búsquedas por pasada, para nada.

Ahora ese resultado marca las tareas que ya existen, y esas no se vuelven
a crear. Da igual quién las creara. Tres cosas que costó aprender:

- **Buscar por PAC no basta.** Los banners no tienen PAC, así que 42 de
  111 tareas quedaban sin comprobar. Se busca por nombre cuando no hay
  PAC.
- **Quedarse con la primera coincidencia tampoco.** Dos tareas pueden
  llamarse igual: en la parrilla de octubre hay dos bloques repetidos. Se
  marcaba una y la otra se creaba de nuevo. Se devuelven todas las
  coincidencias y se reparten una a una.
- **Se vuelve a preguntar antes de escribir**, salvo que se acabe de
  preguntar hace menos de cinco minutos. Quien llega por el enlace
  compartido no ha pasado por el procesado, y es justo quien más riesgo
  tiene de duplicar.

El paso 4 lo dice en dos líneas —cuántas ya están y cuántas faltan— y el
botón solo ofrece crear las que faltan. Lo que no se dice es cuáles
"fallaron pero sí habían llegado": si llegaron, llegaron, y de dónde
venga el dato no le importa a nadie.

### El nombre sí se reescribe. Lo demás no

Una tarea que ya está en Asana no se reescribe: si cambia su fecha, su
producto o su descripción, se avisa y lo corrige una persona.

**El nombre es la excepción**, y por una razón concreta: antes, cambiar
el nombre en el Excel creaba una tarea nueva y dejaba la vieja huérfana
con el nombre antiguo. Eso no es "no reescribir", es ensuciar.

Así que si el Excel cambia el nombre de algo que ya existe, se renombra.
Solo el nombre, nunca otro campo. Y si alguien lo había renombrado en
Asana, se pisa: manda el Excel (decisión de Carlos, 1-oct-2026).

Para poder hacerlo hay que recordar tres cosas de cada tarea cargada —el
enlace, el identificador y el nombre con el que quedó— y arrastrarlas de
una propuesta a la siguiente. Arrastrar solo el enlace, como se hacía,
dejaba la tarea reconocida pero intocable: sin identificador no se puede
renombrar, y sin el nombre anterior no se sabe siquiera que ha cambiado.

Donde esto no llega: un banner renombrado en una propuesta nueva, sin
memoria. El nombre viejo no lo tenemos y el nuevo no existe en Asana, así
que se crea una nueva y la vieja queda suelta. No tiene arreglo sin un
identificador estable en Asana, porque la celda del Excel no existe allí.

### El buscador de Asana va con retraso

Vaciar el sandbox y volver a cargar inmediatamente creó 13 tareas de 42:
el buscador seguía devolviendo las 29 que acababan de borrarse, así que
la comprobación creyó que existían.

En uso normal da igual —nadie borra el proyecto— pero conviene saberlo:
si alguien borra una tarea en Asana, la herramienta tardará un rato en
volver a crearla. Si algún día molesta, se arregla comprobando cada
coincidencia con una lectura directa en vez de fiarse del buscador; son
más llamadas y hoy no compensa.

## Las secciones se reconocen por el nombre, y eso es frágil

El catálogo de secciones se lee de Asana, pero las tablas de `data.js`
usan identificadores propios (`futbol`, `conectividad`). El puente entre
unos y otros es **el nombre**: no puede ser el identificador de Asana,
porque el sandbox y producción tienen uno distinto para la misma
sección.

Y eso significa que **renombrar una sección la desconecta**. Si el
nombre no casa, la sección no se reconoce, `sectionGid` sale vacío y las
tareas se crean sin sección. No falla nada: simplemente aparecen sueltas
arriba del proyecto.

Pasó el 1-oct-2026, al poner aquí "Conectividad y equipamiento" antes de
renombrarla en Asana: ocho campañas se quedaron sin sección y solo se vio
porque la pasada completa se miró tarea a tarea.

Por eso cada sección puede declarar `otrosNombres`: todos los nombres que
ha tenido o va a tener. Con los dos puestos da igual el orden en que se
hagan las cosas, y renombrar en Asana deja de ser una operación que haya
que coordinar con un despliegue.

## El Worker es la única parte que necesita servidor

El token de Asana no puede estar en el navegador, y Asana no acepta
llamadas cross-origin desde una página. Por eso `src/index.js` existe:
tres rutas (`/api/catalogos`, `/api/duplicados`, `/api/cargar`) y el token
como secreto.

Todo lo demás —leer el Excel, leer los PDF, vincular, revisar— sigue
ocurriendo en el navegador, sin que nada salga del ordenador.

## Otros pendientes

- **Definir los estados. Lo decide el equipo de Carlos** (29-sep-2026: "por
  determinar, pendiente de mi equipo"). No es un detalle de configuración: es
  el estado con el que producción va a ver entrar ~73 campañas cada mes. Hoy
  `CATALOGS.estadoInicial` lleva un placeholder (`Pdte Maquetación y envío -
  Movistar`), elegido solo porque Asana lo acepta.

  Dos cosas que hay que llevar a esa conversación:
  - El campo `Estado` tiene 26 opciones, pero los **Tipos de tarea** del
    proyecto solo dejan escribir 12. `Pdte Comercialización`, que era el
    candidato natural, **no** está entre ellas. La restricción no se ve
    leyendo el campo: solo aparece al intentar escribir.
  - El Excel trae `VIABILIDAD` (Aprobada / Planificada) y no hay ningún
    estado que le corresponda. Ese dato se pierde hoy.
- ~~**Tipología (Growth/Value/Servicing).** El campo no existe en el Asana
  actual.~~ **Resuelto (29-sep-2026): no hace falta crearlo.** La tipología
  sirve para agrupar de cara a los equipos, no para definir una campaña. Se
  calcula, se enseña agrupando la revisión, y no se escribe en Asana. Que no
  exista el campo deja de ser un pendiente.
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
