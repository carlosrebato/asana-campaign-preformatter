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
  const encontrados = [];
  for (const pac of pacs) {
    if (!pac) continue;
    const r = await asana(env,
      `/workspaces/${workspaceGid}/tasks/search` +
      `?projects.any=${projectGid}&text=${encodeURIComponent(pac)}` +
      `&opt_fields=name,permalink_url&limit=5`);
    const ya = (r || []).find(t => t.name && t.name.includes(pac));
    if (ya) encontrados.push({ pac, gid: ya.gid, name: ya.name, url: ya.permalink_url });
  }
  return encontrados;
}

/* ---------------- CREAR TAREAS ----------------
   De una en una y a prueba de fallos parciales: si una falla, se
   informa de cuál y las demás siguen. El reporte permite
   reintentar solo las que fallaron.
------------------------------------------------------------ */
async function crear(env, projectGid, tareas) {
  exigirEscribible(projectGid);
  const created = [], failed = [];
  for (const t of tareas) {
    let aviso = '';
    try {
      const base = {
        name: t.name,
        projects: [projectGid],
        notes: t.notes || '',
        ...(t.dueDate ? { due_on: t.dueDate } : {})
      };
      const cf = t.custom_fields || {};

      // Un campo no puede tumbar la carga. Asana rechaza valores que el
      // catálogo sí lista (los tipos de tarea restringen qué opciones
      // valen), y eso no se ve hasta que se intenta escribir. Si pasa,
      // la tarea se crea igual sin campos y se avisa de cuál se perdió.
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

      // La sección se asigna después: /tasks no acepta sección al crear.
      if (t.sectionGid) {
        await asana(env, `/sections/${t.sectionGid}/addTask`, {
          method: 'POST', body: JSON.stringify({ data: { task: tarea.gid } })
        });
      }
      created.push({ id: t.id, name: t.name, gid: tarea.gid, url: tarea.permalink_url, ...(aviso ? { aviso } : {}) });
    } catch (e) {
      failed.push({ id: t.id, name: t.name, error: e.message });
    }
  }
  return { created, failed };
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
