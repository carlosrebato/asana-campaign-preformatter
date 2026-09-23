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
const MAX_DUPLICADOS = 40;   // 1 búsqueda por PAC
const MAX_CARGA = 20;        // 2 llamadas por tarea

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

async function asana(env, ruta, opciones = {}) {
  const r = await fetch(ASANA + ruta, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${env.ASANA_TOKEN}`,
      'Content-Type': 'application/json',
      ...opciones.headers
    }
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = cuerpo.errors?.[0]?.message || `Asana respondió ${r.status}`;
    throw new Error(msg);
  }
  return cuerpo.data;
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
async function duplicados(env, workspaceGid, projectGid, pacs) {
  const lote = pacs.filter(Boolean).slice(0, MAX_DUPLICADOS);
  const resultados = await Promise.all(lote.map(async pac => {
    try {
      const r = await asana(env,
        `/workspaces/${workspaceGid}/tasks/search` +
        `?projects.any=${projectGid}&text=${encodeURIComponent(pac)}` +
        `&opt_fields=name,permalink_url&limit=5`);
      const ya = (r || []).find(t => t.name && t.name.includes(pac));
      return ya ? { pac, gid: ya.gid, name: ya.name, url: ya.permalink_url } : null;
    } catch {
      return null;   // no poder comprobar no puede bloquear la carga
    }
  }));
  return resultados.filter(Boolean);
}

/* ---------------- CREAR TAREAS ----------------
   De una en una y a prueba de fallos parciales: si una falla, se
   informa de cuál y las demás siguen. El reporte permite
   reintentar solo las que fallaron.
------------------------------------------------------------ */
async function crear(env, projectGid, tareas) {
  exigirEscribible(projectGid);

  // En paralelo: secuencial son ~4 minutos para 73 campañas, porque cada
  // llamada a Asana tarda casi dos segundos. El lote lo acota el cliente
  // (MAX_CARGA), así que caben dentro del techo de subpeticiones.
  const resultados = await Promise.all(
    tareas.slice(0, MAX_CARGA).map(t => crearUna(env, projectGid, t))
  );
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
      if (!Object.keys(cf).length) throw e;
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
      if (url.pathname === '/api/duplicados' && request.method === 'POST') {
        const { pacs } = await request.json();
        return json({ duplicados: await duplicados(env, env.ASANA_WORKSPACE_GID, projectGid, pacs) });
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
