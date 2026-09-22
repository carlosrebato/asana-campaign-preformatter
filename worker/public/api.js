/* ============================================================
   Campaign Loader · Capa de API
   ------------------------------------------------------------
   ESTE ES EL ÚNICO FICHERO QUE HAY QUE TOCAR PARA CABLEAR.

   Ahora mismo todo son mocks. Cada función tiene documentado
   qué debe hacer la versión real. La UI no sabe (ni debe saber)
   si detrás hay un mock, la API de Claude, Azure OpenAI o Copilot.

   Contrato de datos: ver data.js → MOCK_TASKS
============================================================ */

const API = {

  /* ----------------------------------------------------------
     0 · CATÁLOGOS
     ----------------------------------------------------------
     Secciones, campos y opciones del proyecto, con sus GIDs.
     Se leen de Asana al arrancar y sustituyen a la copia de
     data.js. Así, cuando alguien añade una opción en Asana,
     aparece sola y nadie tiene que tocar código.

     Si el Worker no responde (no hay backend, no hay token),
     se sigue con la copia: la app funciona igual para revisar,
     solo que no se puede cargar.
  ---------------------------------------------------------- */
  async cargarCatalogos() {
    try {
      const r = await fetch('/api/catalogos');
      if (!r.ok) throw new Error('sin catálogos');
      const c = await r.json();

      CATALOGS.sections = c.sections.map(s => ({
        id: CATALOGS.sections.find(x => x.gid === s.gid)?.id || s.gid,
        gid: s.gid, name: s.name
      }));
      for (const [clave, nombre] of Object.entries(CATALOGS.fieldNames)) {
        if (c.fields[nombre]) CATALOGS.fields[clave] = c.fields[nombre];
      }
      CATALOGS.asanaProject = c.project;
      CATALOGS.esCopia = false;
      return { ok: true, project: c.project.name };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  /* ----------------------------------------------------------
     1 · INTERPRETAR DOCUMENTOS
     ----------------------------------------------------------
     REAL: POST /api/interpretar con el Excel y los documentos de
     estrategia (multipart o base64). El Worker llama al LLM y devuelve
     Tarea[]. La estrategia puede venir repartida en varios documentos,
     uno por equipo: los briefs de todos se juntan.

     El prompt es ../prompts/interpretacion.md — cárgalo como fichero,
     no lo copies aquí. Reglas completas en ../DECISIONES.md.

     Resumen: el Excel manda siempre (ningún campo estructurado sale
     del PDF). Del PDF solo sale contexto de mensaje, con umbral alto
     de vinculación. Cada tarea declara:
       · linkConfidence: 'high' | 'low' | ausente (sin contexto — normal)
       · linkNote: por qué la vinculación es dudosa (solo si 'low')
       · description: el contexto de mensaje en sí, null/'' si no hay
       · contextSource: título de la diapositiva/sección de origen

     El badge de la UI mide la VINCULACIÓN, no la fiabilidad del dato.

     Aislar aquí la llamada al LLM permite migrar a Azure OpenAI
     o Copilot tocando solo esta función.
  ---------------------------------------------------------- */
  async interpretarDocumentos(excelFile, strategyFiles, onProgress) {
    const pasos = [
      'Leyendo Excel de campañas',
      'Extrayendo códigos PAC y fechas',
      'Cruzando con documento de estrategia',
      'Generando propuesta de tareas'
    ];
    for (let i = 0; i < pasos.length; i++) {
      onProgress?.(i, pasos);
      await new Promise(r => setTimeout(r, 620));
    }
    onProgress?.(pasos.length, pasos);
    await new Promise(r => setTimeout(r, 300));

    // Los dos ficheros ya se han leído en inspeccionarFichero. Aquí solo
    // se cruzan: el Excel pone los campos, el documento pone el contexto.
    // Sin Excel real → datos de ejemplo.
    if (excelFile?.parsed) {
      const tasks = JSON.parse(JSON.stringify(excelFile.parsed.tasks));
      const briefs = [].concat(strategyFiles || [])
        .flatMap(d => d?.parsed?.briefs || []);
      return ESTRATEGIA.vincular(tasks, briefs);
    }
    return JSON.parse(JSON.stringify(MOCK_TASKS));
  },

  /* ----------------------------------------------------------
     2 · INSPECCIONAR FICHERO
     ----------------------------------------------------------
     REAL: leer cabeceras del Excel (nº de filas, PACs detectados)
     y metadatos del documento. Sirve para dar feedback inmediato
     al soltar el archivo, ANTES de gastar una llamada al LLM.
  ---------------------------------------------------------- */
  async inspeccionarFichero(file, tipo) {
    // Excel real: se lee entero en el navegador (excel.js, determinista).
    // El resultado viaja con el fichero y lo usa interpretarDocumentos.
    if (file && tipo === 'excel') {
      const buf = await file.arrayBuffer();
      const parsed = EXCEL_PARSER.parse(buf);
      return { name: file.name, ext: 'XLSX', parsed };
    }
    // Estrategia: se extraen los briefs de mensaje (estrategia.js).
    // Si viene ilegible, se devuelve sin briefs y no se avisa de nada:
    // las tareas saldrán sin contexto, que es un estado normal.
    if (file && tipo === 'strategy') {
      const parsed = await ESTRATEGIA.parse(file);
      const ext = (file.name.split('.').pop() || '').toUpperCase();
      return { name: file.name, ext, parsed };
    }
    if (file) {
      const ext = (file.name.split('.').pop() || '').toUpperCase();
      return { name: file.name, ext };
    }
    // Sin fichero (clic en la caja): datos de ejemplo.
    await new Promise(r => setTimeout(r, 420));
    return MOCK_FILES[tipo];
  },

  /* ----------------------------------------------------------
     3 · COMPROBAR PACs DUPLICADOS
     ----------------------------------------------------------
     REAL: buscar en Asana tareas cuyo nombre empiece por cada
     código PAC. Búsqueda DIRIGIDA por PAC — nunca traer todas
     las tareas del proyecto (los reales tienen miles).

     Devuelve los PACs que ya existen para avisar antes de crear.
     Esta es la idempotencia real: la clave de negocio es el PAC.
  ---------------------------------------------------------- */
  async comprobarDuplicados(tasks) {
    const pacs = [...new Set(tasks.map(t => t.pac).filter(Boolean))];
    if (!pacs.length) return [];
    try {
      const r = await fetch('/api/duplicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pacs })
      });
      if (!r.ok) return [];
      return (await r.json()).duplicados || [];
    } catch {
      return [];   // sin backend, no se puede comprobar: no se bloquea
    }
  },

  /* ----------------------------------------------------------
     4 · CARGAR EN ASANA
     ----------------------------------------------------------
     REAL: POST /api/cargar → el Worker crea las tareas vía MCP
     de Asana o API REST.

     · El PAC va al principio del nombre (convención adoptada).
     · Los enum de Asana se escriben por GID de opción, no por
       texto: hace falta el mapa {texto → gid} del proyecto.
     · La sección destino sale de productSectionMap.
     · Carga parcial: si falla alguna, devolver cuáles para
       poder reintentar solo esas.
  ---------------------------------------------------------- */
  async cargarEnAsana(tasks, opts = {}) {
    opts.onProgress?.(0, tasks.length);
    const r = await fetch('/api/cargar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tareas: tasks.map(aPayloadAsana) })
    });
    opts.onProgress?.(tasks.length, tasks.length);
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({}));
      return {
        created: [],
        failed: tasks.map(t => ({ id: t.id, name: t.name, error: error || 'El Worker no respondió' }))
      };
    }
    return r.json();
  }
};


/* ------------------------------------------------------------
   TAREA → PAYLOAD DE ASANA
   Los enum se escriben por GID de opción, nunca por texto. Un
   valor que no esté en el catálogo simplemente no se manda: es
   preferible una tarea con un campo vacío a una carga que falla.
------------------------------------------------------------ */
function aPayloadAsana(t) {
  const cf = {};
  const poner = (clave, valor) => {
    const campo = CATALOGS.fields[clave];
    if (!campo || !valor) return;
    if (campo.tipo === 'text') { cf[campo.gid] = valor; return; }
    const gid = campo.options[valor];
    if (!gid) return;
    cf[campo.gid] = campo.tipo === 'multi_enum' ? [gid] : gid;
  };

  poner('producto', t.product);
  poner('formato', t.format);
  poner('tipoCliente', t.clientType);
  poner('estado', t.estado || CATALOGS.estadoInicial);
  poner('peticionario', t.excel?.responsable);

  return {
    id: t.id,
    name: t.name,
    notes: t.description || '',
    dueDate: t.dueDate || '',
    sectionGid: CATALOGS.sections.find(s => s.id === t.sectionId)?.gid || '',
    custom_fields: cf
  };
}
