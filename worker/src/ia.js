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

import PROMPT_VINCULACION from './prompts/vinculacion.md';
import PROMPT_PRODUCTO from './prompts/producto.md';

const API = 'https://api.anthropic.com/v1/messages';
const MODELO = 'claude-sonnet-5';

async function preguntar(env, system, contenido, maxTokens = 8000) {
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
      messages: [{ role: 'user', content: contenido }]
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
  const i = texto.indexOf('['), j = texto.lastIndexOf(']');
  if (i < 0 || j < 0) return [];
  try { return JSON.parse(texto.slice(i, j + 1)); } catch { return []; }
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
export async function vincular(env, { campanas, briefs }) {
  if (!campanas.length || !briefs.length) return { vinculos: [], uso: null };
  const contenido =
    `BRIEFS DISPONIBLES (${briefs.length}):\n\n` +
    briefs.map(b => `### ${b.titulo}\n[clase: ${b.fuente || 'plantilla'}]\n${b.texto}`).join('\n\n') +
    `\n\n---\n\nCAMPAÑAS A VINCULAR (${campanas.length}):\n\n` +
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

  const { texto, uso } = await preguntar(env, PROMPT_VINCULACION, contenido, 8000);
  return { vinculos: comoArray(texto), uso };
}
