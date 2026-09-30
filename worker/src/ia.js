/* ============================================================
   Campaign Loader · La única llamada a un modelo
   ------------------------------------------------------------
   Dos preguntas, las dos de elección cerrada:

     1 · ¿Qué producto de Asana es este valor del Excel?
     2 · ¿Qué brief le corresponde a esta campaña, o ninguno?

   Conviene no confundir dos cosas distintas:

   · EXTRAER las celdas —qué pone en la fila 34— es determinista,
     y así se queda. Un modelo releyendo 90 filas puede saltarse
     una, y para eso hay una respuesta exacta.

   · INTERPRETAR lo que dicen esas celdas es trabajo del modelo.
     El Excel no es solo campos: la columna OBJETIVO es texto
     libre de quien planifica la campaña y describe de qué va.
     Es lo mejor que hay para emparejar, y por eso viaja entero.

   Los prompts viven en prompts/*.md y se importan como texto.
   Se editan ahí, no aquí.

   Si falla —sin clave, sin red, respuesta ilegible— se devuelve
   vacío y el flujo sigue con lo que tenía. El modelo no puede
   tumbar una carga: mismo principio que el documento de
   estrategia (DECISIONES.md, regla 4).
============================================================ */

import PROMPT_LECTURA from './prompts/lectura.md';
import PROMPT_INDICE from './prompts/indice.md';
import PROMPT_VINCULACION from './prompts/vinculacion.md';
import PROMPT_PRODUCTO from './prompts/producto.md';

const API = 'https://api.anthropic.com/v1/messages';
const MODELO = 'claude-sonnet-5';

// `contenido` puede ser texto o bloques. Los bloques permiten marcar
// una parte como cacheable: en el emparejamiento los briefs son los
// mismos en todas las tandas, y volver a mandarlos cada vez es la mayor
// parte del gasto y de la espera.
// `pensar` decide si el modelo delibera antes de responder.
//
// Leer un documento y decidir qué es material de mensaje SÍ lo
// necesita: sin ello encontró 23 briefs donde antes encontraba 41.
// Emparejar NO: es elegir de una lista con reglas escritas, y
// deliberando escribía 36.000 tokens para devolver 3.000, que era
// toda la espera.
async function preguntar(env, system, contenido, maxTokens = 8000, pensar = false) {
  const r = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: contenido }],
      // Pensando, se deja el ajuste por defecto del modelo; sin
      // pensar, se desactiva explícitamente.
      ...(pensar ? {} : { thinking: { type: 'disabled' } })
    })
  });
  if (!r.ok) throw new Error(`El modelo respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const texto = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return { texto, uso: d.usage };
}

// El modelo devuelve un array JSON. A veces lo envuelve en ``` aunque se
// le pida que no: se recorta al primer [ y al último ].
function comoArray(texto) {
  const i = texto.indexOf('[');
  if (i < 0) return [];
  const j = texto.lastIndexOf(']');
  if (j > i) {
    try { return JSON.parse(texto.slice(i, j + 1)); } catch { /* sigue abajo */ }
  }
  // Si la respuesta se cortó, se rescatan los objetos completos en vez
  // de perder el lote entero.
  const out = [];
  for (const m of texto.matchAll(/\{[^{}]*\}/g)) {
    try { out.push(JSON.parse(m[0])); } catch { /* ignorar el roto */ }
  }
  return out;
}

/* ---------- 0 · LEER LOS DOCUMENTOS ----------
   El modelo lee el texto en crudo y saca el material de mensaje
   aplicando el test del registro. Antes esto lo hacía yo con
   expresiones regulares buscando "idea fuerza", "tono", "reason
   why": funcionaba con el documento de octubre y se rompía con
   cualquier otro, que es justo lo que pasa cada mes.

   Es el paso que hace que la herramienta sobreviva a que el
   formato cambie. No se puede resolver con reglas.
---------------------------------------------------------- */
export async function leerDocumento(env, { nombre, texto }) {
  if (!texto || texto.length < 200) return { briefs: [], uso: null };
  const contenido = `DOCUMENTO: ${nombre}\n\n${texto.slice(0, 180000)}`;
  const { texto: salida, uso } = await preguntar(env, PROMPT_LECTURA, contenido, 16000, true);
  const briefs = comoArray(salida).map(b => ({
    titulo: b.titulo || '',
    texto: b.texto || '',
    // El título que trae el documento en su portada; si no lo encontró,
    // el nombre del fichero, que al menos identifica algo.
    documento: (b.documento || '').trim() || nombre,
    fichero: nombre,
    pagina: Number(b.pagina) > 0 ? Number(b.pagina) : 0,
    fuente: b.clase === 'plantilla' ? 'plantilla' : 'territorio'
  })).filter(b => b.titulo && b.texto);
  return { briefs, uso };
}

/* ---------- 1 bis · ÍNDICE DEL MES ----------
   Los briefs son prosa: un bloque que habla de fútbol puede
   contener tres ofertas para tres colectivos distintos. Mientras
   eso siga dentro del párrafo, quien decida después solo ve "un
   brief de fútbol", y dos campañas que van a colectivos distintos
   acaban con el mismo mensaje o con uno cambiado.

   Este paso saca esas distinciones a una lista. No es una tabla
   escrita a mano: la construye el modelo leyendo, y habla con las
   palabras del documento, no con las de Asana. Normalizar aquí
   sería volver al mapeo manual que se rompe cada mes.

   Si un brief no distingue nada, es una entrada y ya. Eso es
   correcto: hay meses en que el documento no reparte.
---------------------------------------------------------- */
export async function indexar(env, { briefs }) {
  if (!briefs?.length) return { entradas: [], uso: null };
  const contenido = 'BRIEFS DEL MES:\n\n' + conLineas(briefs);
  const { texto, uso } = await preguntar(env, PROMPT_INDICE, contenido, 16000);
  const titulos = new Map(briefs.map(b => [b.titulo.trim().toLowerCase(), b]));
  const entradas = comoArray(texto).map(e => {
    const b = titulos.get(String(e.brief || '').trim().toLowerCase());
    if (!b) return null;   // una entrada que no apunta a un brief real no vale
    return {
      brief: b.titulo,
      documento: b.documento || '',
      pagina: b.pagina || 0,
      fuente: b.fuente || 'territorio',
      producto: (e.producto || '').trim(),
      colectivo: (e.colectivo || '').trim(),
      oferta: (e.oferta || '').trim(),
      distingue: (e.distingue || '').trim(),
      lineas: (e.lineas || '').trim()
    };
  }).filter(Boolean);
  return { entradas, uso };
}

/* ---------- 1 · PRODUCTOS ----------
   Se pregunta por VALOR DISTINTO, no por campaña: los 73 envíos
   de un mes usan una docena de productos. Una llamada pequeña.
---------------------------------------------------------- */
export async function resolverProductos(env, { valores, productos, secciones }) {
  if (!valores.length) return { resueltos: [], uso: null };
  const contenido =
    `PRODUCTOS DE ASANA:\n${productos.join('\n')}\n\n` +
    `SECCIONES:\n${secciones.map(s => `${s.id} · ${s.name}`).join('\n')}\n\n` +
    `VALORES A RESOLVER:\n` +
    valores.map(v => `- "${v.valor}" · ejemplos: ${v.ejemplos.slice(0, 3).join(' | ')}`).join('\n');

  const { texto, uso } = await preguntar(env, PROMPT_PRODUCTO, contenido, 4000);
  return { resueltos: comoArray(texto), uso };
}

/* ---------- 2 · VINCULACIÓN ----------
   Todas las campañas del lote contra todos los briefs del mes.
   El modelo necesita ver el conjunto: parte de la decisión es
   que varias campañas compartan brief, y eso no se ve de una en
   una.
---------------------------------------------------------- */
export async function vincular(env, { campanas, entradas }) {
  if (!campanas.length || !entradas?.length) return { vinculos: [], uso: null };

  // El índice, no los briefs en bruto. La pregunta deja de ser "¿qué
  // párrafo de estos encaja?" y pasa a ser "¿cuál de estas entradas
  // corresponde a estos datos?". Cada entrada lleva un extracto de su
  // propio texto para que se pueda comprobar, pero el texto definitivo
  // se recupera después de las líneas: aquí no se copia nada.
  const bloqueBriefs =
    `ÍNDICE DEL MES (${entradas.length} entradas):\n\n` +
    entradas.map((e, i) => {
      const donde = [e.documento, e.pagina ? `p.${e.pagina}` : ''].filter(Boolean).join(' · ');
      return [
        `E${i + 1} · producto: ${e.producto || '(no lo dice)'}`,
        `   a quién: ${e.colectivo || '(no distingue colectivo)'}`,
        e.oferta ? `   oferta: ${e.oferta}` : '',
        e.distingue ? `   distingue: ${e.distingue}` : '',
        `   brief: ${e.brief} [${e.fuente}]${donde ? ` · ${donde}` : ''}`,
        `   dice: «${(e.extracto || '').slice(0, 260)}»`
      ].filter(Boolean).join('\n');
    }).join('\n\n');

  const bloqueCampanas =
    `CAMPAÑAS A VINCULAR (${campanas.length}):\n\n` +
    campanas.map(c => [
      `- ${c.pac} · ${c.name}`,
      `  producto: ${c.producto} · palanca: ${c.palanca}` +
        (c.subpalanca ? ` · subpalanca: ${c.subpalanca}` : '') +
        ` · medio: ${c.medio} · entrega: ${c.dueDate}`,
      // Lo más valioso de la fila: lo escribió quien planificó la
      // campaña y dice de qué va, con sus palabras.
      c.objetivo ? `  objetivo: ${c.objetivo}` : '',
      c.nombreTarea ? `  pieza: ${c.nombreTarea}` : ''
    ].filter(Boolean).join('\n')).join('\n\n');

  // Holgura de sobra: si la respuesta se corta, el JSON queda ilegible
  // y se pierde el lote entero, no solo la última campaña.
  // Los briefs van marcados como cacheables: se mandan una vez y las
  // demás tandas los reutilizan.
  const contenido = [
    { type: 'text', text: bloqueBriefs, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: bloqueCampanas }
  ];
  // La respuesta es una entrada por campaña, y ahora va de una en una:
  // con 2.000 sobra y se corta antes cualquier divagación.
  const { texto, uso } = await preguntar(env, PROMPT_VINCULACION, contenido,
    Math.min(16000, 600 + campanas.length * 200));
  // La entrada viaja como "E7": aquí se traduce a su posición, que es lo
  // que el cliente necesita para recuperar el texto de sus líneas.
  const vinculos = comoArray(texto).map(v => {
    const n = parseInt(String(v.entrada || '').replace(/[^0-9]/g, ''), 10);
    return {
      pac: v.pac,
      entrada: Number.isInteger(n) && n >= 1 && n <= entradas.length ? n - 1 : -1,
      confianza: v.confianza,
      motivo: v.motivo || ''
    };
  }).filter(v => v.pac);
  return { vinculos, uso, crudo: texto.slice(0, 1200) };
}

// Los briefs con sus líneas numeradas. Numerar es lo que permite señalar
// en vez de copiar, y es lo que impide que se cambie ni una coma.
function conLineas(briefs) {
  return briefs.map(b =>
    `### ${b.titulo}\n[clase: ${b.fuente || 'plantilla'}]\n` +
    b.texto.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n')).join('\n\n');
}
