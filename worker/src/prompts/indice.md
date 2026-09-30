# Prompt · Índice del mes

> Este fichero **es** el prompt. Se edita aquí, no en el código.
> Lee `DECISIONES.md` antes de tocarlo.

Recibes los briefs que se sacaron de los documentos del mes. Tu trabajo es
**desplegarlos en entradas**: las combinaciones concretas que el documento
distingue dentro de cada brief.

No escribes texto nuevo. No resumes. No interpretas la estrategia. Solo
sacas a la luz distinciones que ya están escritas.

## Por qué existe este paso

Un brief de territorio suele contener varias ofertas para varios
colectivos. Por ejemplo, un brief de fútbol puede decir, en párrafos
distintos, que a los clientes que vienen de ficción se les ofrece un
precio y a los que se dieron de baja otro.

Si eso se queda dentro de un bloque de prosa, quien tenga que decidir
después no ve la distinción: ve "un brief que habla de fútbol". Y entonces
dos campañas que van a colectivos distintos acaban con el mismo mensaje, o
peor, con uno intercambiado.

Tu trabajo es que esa distinción quede explícita **antes** de que nadie
tenga que usarla.

## Qué es una entrada

Una entrada es **una de las cosas distintas que dice el brief**, con las
líneas que lo dicen.

- `producto` — de qué producto o servicio habla, con las palabras del
  documento.
- `colectivo` — a quién va dirigido, si el documento lo distingue:
  "clientes que vienen de OTT ficción", "bajas de abril a julio",
  "hostelería sin fútbol".
- `oferta` — el precio, la promoción o el gancho concreto, si lo hay:
  "35€/mes 12 meses", "primer mes gratis", "3 meses a 0€".
- `distingue` — **cualquier otra cosa que separe esta entrada de sus
  vecinas**: un momento del mes ("la semana del Clásico"), un hito
  ("arranque de la NBA"), un canal, una fase de la campaña, de dónde
  viene el cliente. Lo que sea, con las palabras del documento.
- `lineas` — qué líneas del brief dicen eso.

**Los tres primeros son los ejes habituales, no una lista cerrada.** Si lo
que separa dos párrafos de un brief no es el producto ni el colectivo ni
el precio, sino otra cosa, esa cosa va en `distingue` y la entrada es
igual de válida. Lo que no vale es perder la distinción porque no encaje
en una casilla.

## Regla 1 · No inventes ejes

**Si el brief no distingue colectivos, es UNA entrada.** Con `colectivo`
vacío y `lineas` vacío (el brief entero).

Esto va a pasar a menudo y es correcto. Hay documentos que solo dan un
mensaje por territorio, sin repartir. No fuerces divisiones que no están:
una entrada inventada es peor que ninguna, porque después alguien la usará
para decidir.

Lo mismo con `oferta`: si no hay precio ni promoción, déjalo vacío. No
deduzcas.

## Regla 2 · Habla como el documento, no como el sistema

No traduzcas ni normalices. Si el documento dice "OTT ficción", escribe
"OTT ficción", no "clientes de ficción" ni "M+ Ficción". Si dice
"hostelería", no lo cambies por "Horecas".

Quien use el índice después tendrá que unir tu vocabulario con el del
Excel, que es distinto. Eso lo hace otro paso, y lo hace mejor si tú no
has movido nada de sitio.

## Regla 3 · Las líneas son del brief, y son literales

Cada brief te llega con sus líneas numeradas. `lineas` apunta a ellas:
`"4-6"`, `"1,3,7-9"`. Deja `lineas` vacío si la entrada usa el brief
entero.

Nunca copies el texto. Se recupera solo, a partir de los números, y así no
puede cambiarse ni una coma de lo que escribió Comercialización.

## Regla 4 · Una entrada puede servir a varias campañas

No estás repartiendo campañas: no las has visto. Estás diciendo qué
distinciones hace el documento. Que una entrada acabe sirviendo a seis
campañas es normal.

## Regla 5 · Si dos entradas dicen lo mismo, es una

No dupliques por matices de redacción. Dos párrafos que ofrecen lo mismo
al mismo colectivo son una entrada.

## Formato de salida

Solo un array JSON, sin texto alrededor y sin ```:

```
[
  { "brief": "Desarrollo y winback de fútbol", "producto": "Fútbol Total",
    "colectivo": "clientes que vienen de OTT ficción", "oferta": "35€/mes 12 meses",
    "distingue": "", "lineas": "4-6" },
  { "brief": "Desarrollo y winback de fútbol", "producto": "Fútbol Total",
    "colectivo": "bajas de fin de temporada", "oferta": "39€/mes",
    "distingue": "", "lineas": "11-13" },
  { "brief": "Enews de contenidos", "producto": "", "colectivo": "",
    "oferta": "", "distingue": "la semana del Clásico", "lineas": "7-9" },
  { "brief": "Estrategia de marca", "producto": "", "colectivo": "",
    "oferta": "", "distingue": "", "lineas": "" }
]
```

- `brief`: el **título exacto** de un brief de los que te llegan.
- `producto`, `colectivo`, `oferta`, `distingue`: con las palabras del
  documento, o vacío si el documento no lo dice.
- `lineas`: `"4-6"`, o vacío para el brief entero.

Todos los briefs tienen que aparecer al menos una vez. Si uno no distingue
nada, sale con una entrada vacía; no lo dejes fuera.
