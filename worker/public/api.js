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
     0 bis · EMPAREJAMIENTO CON MODELO
     ----------------------------------------------------------
     Las dos preguntas que no se pueden resolver con una tabla
     sin que alguien la mantenga cada mes:

       · qué producto de Asana es un valor nuevo del Excel
       · qué brief le toca a cada campaña, o ninguno

     Se le manda la fila entera, incluido el objetivo —el texto
     libre de quien planificó la campaña—, que es lo que de
     verdad permite distinguir un desarrollo de un winback.

     Si el modelo no está disponible, se devuelve lo que había:
     nunca rompe la carga.
  ---------------------------------------------------------- */
  async emparejarConModelo(tasks, briefs, onProgress) {
    const campanas = tasks.map(t => ({
      pac: t.pac, name: t.name,
      producto: t.excel?.producto || '', palanca: t.excel?.palanca || '',
      subpalanca: t.excel?.subpalanca || '', medio: t.excel?.medio || '',
      objetivo: t.excel?.objetivo || '', nombreTarea: t.excel?.nombreTarea || '',
      dueDate: t.dueDate
    }));

    const vinculos = [];
    const lotes = enLotes(campanas, 25);
    let hechos = 0;
    for (const lote of lotes) {
      try {
        const r = await fetch('/api/vincular', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campanas: lote, briefs })
        });
        if (r.ok) vinculos.push(...((await r.json()).vinculos || []));
      } catch { /* sin modelo se sigue con lo que hay */ }
      hechos += lote.length;
      onProgress?.(hechos, campanas.length);
    }
    return vinculos;
  },

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

      // Por NOMBRE, no por GID: un proyecto duplicado tiene las mismas
      // secciones con identificadores nuevos. Emparejar por GID dejaba
      // todas las tareas apuntando a secciones inexistentes y la
      // revisión salía vacía.
      CATALOGS.sections = c.sections.map(s => ({
        id: CATALOGS.sections.find(x => x.name === s.name)?.id || s.gid,
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
  async comprobarDuplicados(tasks, onProgress) {
    const pacs = [...new Set(tasks.map(t => t.pac).filter(Boolean))];
    if (!pacs.length) return [];
    const encontrados = [];
    // Por lotes: un Worker no puede hacer más de 50 llamadas salientes
    // por invocación, y cada PAC es una búsqueda.
    for (const lote of enLotes(pacs, 40)) {
      try {
        const r = await fetch('/api/duplicados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pacs: lote })
        });
        if (r.ok) encontrados.push(...((await r.json()).duplicados || []));
      } catch {
        /* sin backend no se puede comprobar: no se bloquea la carga */
      }
      onProgress?.(encontrados.length);
    }
    return encontrados;
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
    const created = [], failed = [];
    let hechas = 0;
    opts.onProgress?.(0, tasks.length);

    // Por lotes, por el límite de llamadas salientes del Worker: cada
    // tarea son dos (crearla y colocarla en su sección). Lotes pequeños
    // y varios en vuelo: así la barra avanza de verdad en vez de saltar
    // del 0 al 100, y el conjunto va igual de rápido.
    // El lote se dimensiona para que la barra avance varias veces, tanto
    // si son 4 campañas como si son 73: al menos cuatro tramos, y nunca
    // más de 8 por lote (cada tarea son dos llamadas al Worker).
    const EN_VUELO = 4;
    const tam = Math.max(1, Math.min(8, Math.ceil(tasks.length / 4)));
    const lotes = enLotes(tasks, tam);

    const mandar = async lote => {
      try {
        const r = await fetch('/api/cargar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tareas: lote.map(aPayloadAsana) })
        });
        if (!r.ok) {
          const { error } = await r.json().catch(() => ({}));
          return { created: [], failed: lote.map(t => ({ id: t.id, name: t.name, error: error || 'El Worker no respondió' })) };
        }
        return await r.json();
      } catch (e) {
        return { created: [], failed: lote.map(t => ({ id: t.id, name: t.name, error: e.message })) };
      }
    };

    let siguiente = 0;
    const turno = async () => {
      while (siguiente < lotes.length) {
        const res = await mandar(lotes[siguiente++]);
        created.push(...(res.created || []));
        failed.push(...(res.failed || []));
        opts.onProgress?.(created.length + failed.length, tasks.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(EN_VUELO, lotes.length) }, turno));

    return { created, failed };
  }

};


/* ------------------------------------------------------------
   TROCEAR
   El Worker tiene un techo de llamadas salientes por invocación,
   así que el cliente parte el trabajo y llama varias veces.
------------------------------------------------------------ */
function enLotes(lista, tam) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += tam) lotes.push(lista.slice(i, i + tam));
  return lotes;
}

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
  poner('objetivo', CATALOGS.palancaObjetivo[t.palanca]);
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
