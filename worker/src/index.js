/* ============================================================
   Campaign Loader · Worker
   ------------------------------------------------------------
   Dos rutas, las dos contra la API REST de Asana. El token vive
   como secreto del Worker y NUNCA llega al navegador:

     npx wrangler secret put ASANA_TOKEN

   Por qué el Worker y no el navegador: el token no puede estar
   en el cliente, y Asana no permite llamadas cross-origin desde
   una página. Es la única parte que necesita servidor.

   Esto es el envoltorio desechable (ver DECISIONES.md). Si el
   destino acaba siendo infraestructura corporativa, se reescribe
   este fichero y nada más.
============================================================ */

import { leerDocumento, unificar, indexar, resolverProductos, vincular } from './ia.js';

const ASANA = 'https://app.asana.com/api/1.0';

/* ------------------------------------------------------------
   LÍMITE DE SUBPETICIONES
   ------------------------------------------------------------
   Un Worker no puede hacer más de 50 llamadas salientes por
   invocación. Con 73 campañas eso se supera sin despeinarse:
   la comprobación de duplicados son 73 búsquedas y la carga son
   dos llamadas por tarea (crear + colocar en su sección).

   Por eso el cliente trocea y llama varias veces. Estos números
   son el tamaño máximo de cada trozo, con margen.
------------------------------------------------------------ */
const MAX_DUPLICADOS = 40;   // 1 búsqueda por tarea
const MAX_CARGA = 20;        // 2 llamadas por tarea

// Asana no deja escribir más de ~15 cosas a la vez, contando TODAS las
// invocaciones en vuelo. El cliente manda 3 lotes en paralelo, así que
// 3 por lote deja el total en 9, con margen para los reintentos.
const A_LA_VEZ = 3;

/* ------------------------------------------------------------
   GUARDARRAÍL · PROYECTOS DONDE NO SE ESCRIBE NUNCA
   ------------------------------------------------------------
   BTL - Run ✉️ es el proyecto de producción: lo ven muchas
   personas y tiene miles de tareas. Una carga mal hecha ahí
   ensucia el sistema de todo el equipo y cuesta más limpiarlo
   que rehacerlo.

   Esta lista no es documentación: el Worker comprueba contra
   ella ANTES de cada escritura y devuelve 403. Leer sí, escribir
   no. Para levantar el bloqueo hay que editar este fichero a
   propósito, que es exactamente la fricción que queremos.
------------------------------------------------------------ */
const SOLO_LECTURA = {
  '1204870393367337': 'BTL - Run ✉️ (producción)'
};

function exigirEscribible(projectGid) {
  const motivo = SOLO_LECTURA[projectGid];
  if (motivo) {
    throw Object.assign(
      new Error(`Bloqueado: ${motivo} es de solo lectura. No se escribe ahí.`),
      { status: 403 }
    );
  }
}

// Asana tiene dos techos distintos y el que nos pilla es el segundo:
// peticiones por minuto, y peticiones *a la vez* (unas 15 para escribir).
// Pasado ese, contesta 429 y dice "too many requests at the same time".
//
// Un 429 no es un error de la tarea: es "ahora no, vuelve en un momento".
// Así que se espera lo que pida la cabecera Retry-After y se reintenta.
// Sin esto, una carga de 73 campañas dejaba la mitad sin crear.
const ESPERAS = [1200, 3000, 6000];

async function asana(env, ruta, opciones = {}) {
  let ultimo = '';
  for (let intento = 0; intento <= ESPERAS.length; intento++) {
    const r = await fetch(ASANA + ruta, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${env.ASANA_TOKEN}`,
        'Content-Type': 'application/json',
        ...opciones.headers
      }
    });
    if (r.ok) return (await r.json().catch(() => ({}))).data;

    const cuerpo = await r.json().catch(() => ({}));
    ultimo = cuerpo.errors?.[0]?.message || `Asana respondió ${r.status}`;

    // 429 (demasiadas) y 5xx (Asana de capa caída) se reintentan.
    // Lo demás es culpa nuestra y reintentar no lo arregla.
    const reintentable = r.status === 429 || r.status >= 500;
    if (!reintentable || intento === ESPERAS.length) {
      // El código viaja con el error: quien lo recoja tiene que poder
      // distinguir "este dato no vale" de "ahora mismo no puedo".
      throw Object.assign(new Error(ultimo), { status: r.status });
    }

    const dice = Number(r.headers.get('Retry-After')) * 1000;
    await new Promise(z => setTimeout(z, dice > 0 ? Math.min(dice, 10000) : ESPERAS[intento]));
  }
  throw new Error(ultimo);
}

/* ---------------- CATÁLOGOS ----------------
   Secciones, campos y opciones del proyecto, con sus GIDs. Se
   leen aquí y no se copian al código: si mañana añaden una
   opción en Asana, aparece sola.
------------------------------------------------------------ */
async function catalogos(env, projectGid) {
  const campos = 'custom_field_settings.custom_field.name,' +
    'custom_field_settings.custom_field.resource_subtype,' +
    'custom_field_settings.custom_field.enum_options.name,' +
    'custom_field_settings.custom_field.enum_options.gid';
  const [proyecto, secciones] = await Promise.all([
    asana(env, `/projects/${projectGid}?opt_fields=name,${campos}`),
    asana(env, `/projects/${projectGid}/sections?opt_fields=name`)
  ]);

  const fields = {};
  for (const ajuste of proyecto.custom_field_settings || []) {
    const cf = ajuste.custom_field;
    fields[cf.name] = {
      gid: cf.gid,
      tipo: cf.resource_subtype,
      options: Object.fromEntries((cf.enum_options || []).map(o => [o.name, o.gid]))
    };
  }
  return {
    project: { gid: projectGid, name: proyecto.name },
    sections: secciones.map(s => ({ gid: s.gid, name: s.name })),
    fields
  };
}

/* ---------------- DUPLICADOS ----------------
   Búsqueda DIRIGIDA por PAC. El proyecto real tiene miles de
   tareas: traerlas todas no es una opción.
------------------------------------------------------------ */
async function duplicados(env, workspaceGid, projectGid, busquedas) {
  const lote = busquedas
    .map(b => (typeof b === 'string' ? { id: b, texto: b } : b))
    .filter(b => b && b.texto)
    .slice(0, MAX_DUPLICADOS);

  const resultados = await Promise.all(lote.map(async b => {
    try {
      const r = await asana(env,
        `/workspaces/${workspaceGid}/tasks/search` +
        `?projects.any=${projectGid}&text=${encodeURIComponent(b.texto)}` +
        `&opt_fields=name,permalink_url&limit=5`);
      // El buscador de Asana es generoso: devuelve parecidos. Valen las
      // que de verdad contienen lo que buscábamos, no las que se parecen.
      //
      // Y se devuelven TODAS, no la primera. Dos tareas pueden llamarse
      // igual —en octubre pasa dos veces, porque la parrilla de banners
      // tiene bloques repetidos— y quedarse con una dejaba a la otra sin
      // marcar: en la carga siguiente se creaba otra vez.
      const ya = (r || []).filter(t => t.name && t.name.includes(b.texto));
      return ya.length
        ? { id: b.id, pac: b.pac || '', texto: b.texto,
            encontradas: ya.map(t => ({ gid: t.gid, name: t.name, url: t.permalink_url })) }
        : null;
    } catch {
      return null;   // no poder comprobar no puede bloquear la carga
    }
  }));
  return resultados.filter(Boolean);
}

/* ---------------- RENOMBRAR LO QUE YA EXISTE ----------------
   Cuando el Excel cambia el nombre de una campaña, la tarea de Asana es
   la misma tarea. Crear otra dejaba la vieja huérfana, con el nombre
   antiguo, y a alguien limpiándolo a mano.

   Manda el Excel: si alguien la renombró en Asana, se pisa. Es el único
   campo que se reescribe —nunca fecha, producto ni descripción— porque
   es el único del que el Excel es la fuente.
------------------------------------------------------------ */
async function renombrar(env, projectGid, tareas) {
  exigirEscribible(projectGid);
  const lote = (tareas || []).filter(t => t && t.gid && t.name).slice(0, MAX_CARGA);
  const resultados = new Array(lote.length);
  let siguiente = 0;
  const turno = async () => {
    while (siguiente < lote.length) {
      const i = siguiente++;
      const t = lote[i];
      try {
        await asana(env, `/tasks/${t.gid}`, {
          method: 'PUT', body: JSON.stringify({ data: { name: t.name } })
        });
        resultados[i] = { ok: true, dato: { id: t.id, gid: t.gid, name: t.name } };
      } catch (e) {
        resultados[i] = { ok: false, dato: { id: t.id, name: t.name, error: e.message } };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, lote.length) }, turno));
  return {
    renamed: resultados.filter(r => r.ok).map(r => r.dato),
    failed: resultados.filter(r => !r.ok).map(r => r.dato)
  };
}

/* ---------------- CREAR TAREAS ----------------
   De una en una y a prueba de fallos parciales: si una falla, se
   informa de cuál y las demás siguen. El reporte permite
   reintentar solo las que fallaron.
------------------------------------------------------------ */
async function crear(env, projectGid, tareas) {
  exigirEscribible(projectGid);

  // En paralelo, pero con freno: secuencial son ~4 minutos para 73
  // campañas, porque cada llamada a Asana tarda casi dos segundos. Sin
  // freno, en cambio, el cliente mandaba cuatro lotes a la vez y salían
  // más de treinta escrituras simultáneas: Asana devolvía 429 y la carga
  // se caía a trozos. Tres a la vez por invocación, y como el cliente
  // manda tres lotes en vuelo, son nueve, por debajo del techo de Asana.
  const pendientes = tareas.slice(0, MAX_CARGA);
  const resultados = new Array(pendientes.length);
  let siguiente = 0;
  const turno = async () => {
    while (siguiente < pendientes.length) {
      const i = siguiente++;
      resultados[i] = await crearUna(env, projectGid, pendientes[i]);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(A_LA_VEZ, pendientes.length) }, turno));
  return {
    created: resultados.filter(r => r.ok).map(r => r.dato),
    failed: resultados.filter(r => !r.ok).map(r => r.dato)
  };
}

async function crearUna(env, projectGid, t) {
  let aviso = '';
  try {
    const base = {
      name: t.name,
      projects: [projectGid],
      notes: t.notes || '',
      ...(t.dueDate ? { due_on: t.dueDate } : {})
    };
    const cf = t.custom_fields || {};

    let tarea;
    try {
      tarea = await asana(env, '/tasks', {
        method: 'POST',
        body: JSON.stringify({ data: Object.keys(cf).length ? { ...base, custom_fields: cf } : base })
      });
    } catch (e) {
      // Reintentar sin campos solo tiene sentido si el problema SON los
      // campos. Con un 429 o un 500, los campos están bien y volver a
      // pedirlo pelado crearía la tarea a medias sin que nadie lo note.
      if (!Object.keys(cf).length || e.status === 429 || e.status >= 500) throw e;
      // Un campo no puede tumbar la carga: se reintenta sin ellos.
      // No se puede saber cuál sobra: Asana devuelve las opciones
      // válidas pero no dice de qué campo, y los valores de los demás
      // campos tampoco están en esa lista. Se avisa y se sigue.
      tarea = await asana(env, '/tasks', { method: 'POST', body: JSON.stringify({ data: base }) });
      aviso = `Creada sin campos personalizados. Asana: ${e.message.slice(0, 140)}`;
    }

    // La sección se asigna después: /tasks no la acepta al crear.
    if (t.sectionGid) {
      await asana(env, `/sections/${t.sectionGid}/addTask`, {
        method: 'POST', body: JSON.stringify({ data: { task: tarea.gid } })
      });
    }
    return { ok: true, dato: { id: t.id, name: t.name, gid: tarea.gid, url: tarea.permalink_url, ...(aviso ? { aviso } : {}) } };
  } catch (e) {
    return { ok: false, dato: { id: t.id, name: t.name, error: e.message } };
  }
}

/* ---------------- PROPUESTAS COMPARTIDAS ----------------
   La propuesta deja de vivir en el navegador de quien sube los
   ficheros y pasa a tener un enlace propio. Así el responsable
   de cada campaña entra, revisa lo suyo y aprueba, y todos ven
   lo mismo.

   No hay usuarios ni contraseñas: quien tenga el enlace puede
   aprobar. Es un equipo y hay confianza (decisión tomada), pero
   por eso el identificador es largo y no adivinable.
---------------------------------------------------------- */
function nuevoId() {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

async function guardarPropuesta(env, id, datos) {
  if (!env.PROPUESTAS) throw new Error('Falta el almacén de propuestas');
  const ahora = new Date().toISOString();
  const previa = await env.PROPUESTAS.get(id, 'json');

  // Si llegan cambios sueltos se aplican sobre lo guardado, en vez de
  // sobrescribir la propuesta entera. Así dos personas revisando a la
  // vez no se pisan: cada una toca sus tareas.
  let tareas = datos.tareas || previa?.tareas || [];
  if (previa && Array.isArray(datos.cambios)) {
    const porId = new Map(previa.tareas.map(t => [t.id, t]));
    for (const c of datos.cambios) {
      const t = porId.get(c.id);
      if (t) Object.assign(t, c.campos);
    }
    tareas = [...porId.values()];
  }

  const doc = {
    id,
    creada: previa?.creada || ahora,
    actualizada: ahora,
    version: (previa?.version || 0) + 1,
    ficheros: datos.ficheros || previa?.ficheros || {},
    // El material de mensaje que sacó el modelo de los documentos se
    // guarda con la propuesta. Si vuelve el mismo Excel corregido, no
    // hay que releer nada: los documentos son los de siempre.
    briefs: datos.briefs || previa?.briefs || [],
    // El índice del mes: qué oferta va a qué colectivo. Se guarda con la
    // propuesta para no rehacerlo si vuelve el mismo Excel corregido.
    entradas: datos.entradas || previa?.entradas || [],
    tareas
  };
  // 90 días: una planificación mensual no se revisa más allá de eso.
  await env.PROPUESTAS.put(id, JSON.stringify(doc), { expirationTtl: 60 * 60 * 24 * 90 });
  return doc;
}

/* ---------------- VACIAR EL SANDBOX ----------------
   Probar de verdad exige empezar con el proyecto vacío, y borrar
   ochenta tareas a mano cada vez no es razonable.

   Tres cerrojos, porque esto borra y borrar no se deshace:
   · el proyecto no puede estar en SOLO_LECTURA
   · su nombre tiene que contener SANDBOX
   · hay que mandar su propio identificador como confirmación
------------------------------------------------------------ */
async function vaciarSandbox(env, projectGid, confirmacion) {
  exigirEscribible(projectGid);
  if (confirmacion !== projectGid) {
    throw Object.assign(new Error('Falta la confirmación con el identificador del proyecto'), { status: 400 });
  }
  const proyecto = await asana(env, `/projects/${projectGid}?opt_fields=name`);
  if (!/sandbox/i.test(proyecto.name || '')) {
    throw Object.assign(new Error(`"${proyecto.name}" no es un sandbox. Aquí no se vacía nada.`), { status: 403 });
  }

  const tareas = await asana(env, `/projects/${projectGid}/tasks?opt_fields=name&limit=100`);
  const lote = (tareas || []).slice(0, 45);   // techo de subpeticiones
  const hechas = await Promise.all(lote.map(async t => {
    try { await asana(env, `/tasks/${t.gid}`, { method: 'DELETE' }); return true; }
    catch { return false; }
  }));
  return {
    proyecto: proyecto.name,
    borradas: hechas.filter(Boolean).length,
    quedan: Math.max(0, (tareas || []).length - lote.length)
  };
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json' }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (!env.ASANA_TOKEN) {
      return json({ error: 'Falta el secreto ASANA_TOKEN en el Worker' }, 500);
    }

    try {
      const projectGid = env.ASANA_PROJECT_GID;
      if (url.pathname === '/api/catalogos') {
        const c = await catalogos(env, projectGid);
        // La UI enseña si el destino admite escritura o no.
        return json({ ...c, soloLectura: !!SOLO_LECTURA[projectGid] });
      }
      if (url.pathname === '/api/renombrar' && request.method === 'POST') {
        const { tareas } = await request.json();
        return json(await renombrar(env, projectGid, tareas));
      }
      if (url.pathname === '/api/duplicados' && request.method === 'POST') {
        // `busquedas` es la forma nueva: {id, texto} por tarea, que
        // permite buscar también lo que no tiene PAC —los banners— por su
        // nombre. `pacs` se sigue aceptando para no romper una propuesta
        // guardada con la versión anterior.
        const { busquedas, pacs } = await request.json();
        const lista = busquedas || (pacs || []).map(p => ({ id: p, pac: p, texto: p }));
        return json({ duplicados: await duplicados(env, env.ASANA_WORKSPACE_GID, projectGid, lista) });
      }
      // El modelo solo se usa para elegir entre opciones cerradas.
      // Si no hay clave, se responde vacío y el flujo sigue sin él.
      // Crear o actualizar una propuesta compartida.
      if (url.pathname === '/api/propuesta' && request.method === 'POST') {
        const datos = await request.json();
        const id = datos.id || nuevoId();
        return json(await guardarPropuesta(env, id, datos));
      }
      // Leerla por su enlace.
      if (url.pathname.startsWith('/api/propuesta/') && request.method === 'GET') {
        const id = url.pathname.split('/').pop();
        const doc = env.PROPUESTAS ? await env.PROPUESTAS.get(id, 'json') : null;
        if (!doc) return json({ error: 'Esa propuesta ya no existe' }, 404);
        // Con ?desde=N solo se devuelve si alguien la ha tocado después:
        // así se puede preguntar cada pocos segundos sin gastar.
        const desde = +url.searchParams.get('desde');
        if (desde && doc.version <= desde) return json({ version: doc.version, sinCambios: true });
        return json(doc);
      }
      if (url.pathname === '/api/leer' && request.method === 'POST') {
        // Sin clave no hay herramienta: leer los documentos ES el
        // producto. Devolver una lista vacía y seguir haría creer que
        // los documentos no tenían nada, que es lo contrario de lo que
        // pasa. Un 503 se ve en pantalla y dice qué falta.
        if (!env.ANTHROPIC_API_KEY) {
          throw Object.assign(new Error(
            'Falta la clave del modelo (ANTHROPIC_API_KEY) en este Worker. ' +
            'Sin ella no se pueden leer los documentos.'), { status: 503 });
        }
        return json(await leerDocumento(env, await request.json()));
      }
      if (url.pathname === '/api/productos' && request.method === 'POST') {
        if (!env.ANTHROPIC_API_KEY) return json({ resueltos: [], sinModelo: true });
        return json(await resolverProductos(env, await request.json()));
      }
      if (url.pathname === '/api/unificar' && request.method === 'POST') {
        if (!env.ANTHROPIC_API_KEY) {
          throw Object.assign(new Error('Falta la clave del modelo (ANTHROPIC_API_KEY) en este Worker.'), { status: 503 });
        }
        return json(await unificar(env, await request.json()));
      }
      if (url.pathname === '/api/indice' && request.method === 'POST') {
        if (!env.ANTHROPIC_API_KEY) {
          throw Object.assign(new Error('Falta la clave del modelo (ANTHROPIC_API_KEY) en este Worker.'), { status: 503 });
        }
        return json(await indexar(env, await request.json()));
      }
      if (url.pathname === '/api/vincular' && request.method === 'POST') {
        if (!env.ANTHROPIC_API_KEY) {
          throw Object.assign(new Error('Falta la clave del modelo (ANTHROPIC_API_KEY) en este Worker.'), { status: 503 });
        }
        const cuerpo = await request.json();
        const res = await vincular(env, cuerpo);
        // ?crudo=1 devuelve además el texto tal cual, para depurar.
        return json(url.searchParams.get('crudo') ? res : { vinculos: res.vinculos, uso: res.uso });
      }
      if (url.pathname === '/api/vaciar-sandbox' && request.method === 'POST') {
        const { confirmacion } = await request.json();
        return json(await vaciarSandbox(env, projectGid, confirmacion));
      }
      if (url.pathname === '/api/cargar' && request.method === 'POST') {
        const { tareas } = await request.json();
        return json(await crear(env, projectGid, tareas));
      }
      return json({ error: 'Ruta desconocida' }, 404);
    } catch (e) {
      return json({ error: e.message }, e.status || 502);
    }
  }
};
