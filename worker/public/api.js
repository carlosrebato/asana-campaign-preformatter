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
     1 · INTERPRETAR DOCUMENTOS
     ----------------------------------------------------------
     REAL: POST /api/interpretar con los dos ficheros (multipart
     o base64). El Worker llama al LLM y devuelve Tarea[].

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
  async interpretarDocumentos(excelFile, strategyFile, onProgress) {
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
      return ESTRATEGIA.vincular(tasks, strategyFile?.parsed?.briefs || []);
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
    await new Promise(r => setTimeout(r, 300));
    return []; // ningún duplicado en el mock
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
    const total = tasks.length;
    for (let i = 0; i <= total; i++) {
      opts.onProgress?.(i, total);
      await new Promise(r => setTimeout(r, 130));
    }

    // El mock simula fallos para poder enseñar el reporte de carga
    // parcial. En 0 para la demo: carga "todo verde".
    const nFail = Math.min(opts.simulateFailures ?? 0, Math.max(0, total - 1));
    const ok = tasks.slice(0, total - nFail);
    const failed = tasks.slice(total - nFail);

    return {
      created: ok.map(t => ({
        id: t.id,
        name: t.name,
        url: 'https://app.asana.com/0/0/' + t.id
      })),
      failed: failed.map(t => ({
        id: t.id,
        name: t.name,
        error: 'Timeout al crear la tarea en Asana'
      }))
    };
  }
};
