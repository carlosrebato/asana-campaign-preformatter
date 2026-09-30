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
     0 ter · PROPUESTA COMPARTIDA
     ----------------------------------------------------------
     La propuesta deja de vivir en el navegador de quien sube los
     ficheros: se guarda y tiene enlace propio. El responsable de
     cada campaña entra por ahí, revisa lo suyo y aprueba, y todos
     ven el mismo estado.

     Guardar no puede romper nada: si falla, se sigue trabajando
     en local y solo se pierde la posibilidad de compartir.
  ---------------------------------------------------------- */
  async crearPropuesta(ficheros, tareas, briefs, entradas) {
    try {
      const r = await fetch('/api/propuesta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ficheros, tareas, briefs, entradas })
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  },

  // Un Excel corregido reescribe la propuesta entera, conservando su
  // enlace: es el que ha circulado por el equipo. A diferencia de
  // guardarCambios, aquí la lista de tareas manda.
  async guardarPropuesta(id, ficheros, tareas, briefs, entradas) {
    const r = await fetch('/api/propuesta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ficheros, tareas, briefs, entradas })
    });
    if (!r.ok) throw new Error('No se ha podido guardar la propuesta actualizada');
    return await r.json();
  },

  // Se mandan solo las tareas tocadas, y el servidor las aplica sobre lo
  // guardado. Si otra persona está revisando a la vez, no se pisan.
  async guardarCambios(id, cambios) {
    try {
      const r = await fetch('/api/propuesta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios })
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  },

  // Con `desde` el servidor contesta enseguida si nadie ha tocado nada.
  async abrirPropuesta(id, desde) {
    try {
      const r = await fetch('/api/propuesta/' + encodeURIComponent(id)
        + (desde ? `?desde=${desde}` : ''));
      return r.ok ? await r.json() : null;
    } catch { return null; }
  },

  /* ----------------------------------------------------------
     0 bis · LEER LOS DOCUMENTOS
     ----------------------------------------------------------
     El modelo lee el texto y saca el material de mensaje. Es el
     paso que hace que esto sobreviva a que el formato cambie
     cada mes, y no se puede resolver con reglas.

     Por trozos, porque con un documento entero el modelo se
     pierde y además la llamada se pasa de tiempo. Se corta por
     páginas y los briefs del mismo territorio se juntan.
  ---------------------------------------------------------- */
  async leerDocumentos(docs, onProgress) {
    // Se trocea para que el modelo no se pierda, pero quien mira cuenta
    // documentos, no trozos: se informa de las dos cosas.
    const partes = [];
    docs.forEach((d, i) => {
      for (const trozo of ESTRATEGIA.trozos(d.texto || '')) {
        partes.push({ nombre: d.name, texto: trozo, doc: i + 1 });
      }
    });
    if (!partes.length) return [];

    const briefs = [];
    let fallo = '';
    let hechas = 0;
    const leer = async parte => {
      try {
        const r = await fetch('/api/leer', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parte)
        });
        if (r.ok) briefs.push(...((await r.json()).briefs || []));
        else {
          const { error } = await r.json().catch(() => ({}));
          fallo = error || `El servidor respondió ${r.status}`;
        }
      } catch (e) { fallo = e.message; }
      hechas++;
      onProgress?.({ hechas, total: partes.length, nombre: parte.nombre,
                     doc: parte.doc, docs: docs.length });
    };

    // De tres en tres: más rápido sin tentar los límites.
    let siguiente = 0;
    const turno = async () => { while (siguiente < partes.length) await leer(partes[siguiente++]); };
    await Promise.all(Array.from({ length: Math.min(3, partes.length) }, turno));

    // Un territorio puede aparecer en dos trozos: se juntan.
    const porTitulo = new Map();
    for (const b of briefs) {
      const k = b.titulo.trim().toLowerCase();
      if (porTitulo.has(k)) {
        const y = porTitulo.get(k);
        if (!y.texto.includes(b.texto)) y.texto += '\n' + b.texto;
      } else porTitulo.set(k, { ...b });
    }

    // El título de verdad suele estar en la portada, así que solo lo ve
    // el primer trozo. Los demás devuelven el nombre del fichero. Se
    // reparte el que sí se encontró a todos los briefs de ese fichero.
    const titulos = new Map();  // fichero → título del documento
    for (const b of porTitulo.values()) {
      if (b.documento && b.documento !== b.fichero && !titulos.has(b.fichero)) {
        titulos.set(b.fichero, b.documento);
      }
    }
    for (const b of porTitulo.values()) {
      if (titulos.has(b.fichero)) b.documento = titulos.get(b.fichero);
    }
    // Si no salió ni un brief Y hubo un fallo, no es que los documentos
    // no dijeran nada: es que no se pudieron leer. Son cosas distintas y
    // la pantalla tiene que poder distinguirlas.
    // El texto corrido se compone de los campos, en orden fijo y con sus
    // etiquetas. Es lo que se numera para señalar líneas, así que tiene
    // que salir igual siempre: una sola fuente, los campos.
    const lista = [...porTitulo.values()].map(b => ({ ...b, texto: textoDeCampos(b) }));
    return Object.assign(lista, { fallo });
  },

  /* ----------------------------------------------------------
     0 bis · JUNTAR LO QUE ES EL MISMO TERRITORIO
     ----------------------------------------------------------
     Se leen por trozos y el mismo territorio sale con nombres
     distintos en cada uno. Juntar por título exacto dejaba el
     material partido; juntar por parecido del nombre confundiría
     «Fútbol captación» con «Fútbol winback». Lo junta el modelo
     leyendo lo que dicen dentro.
  ---------------------------------------------------------- */
  async unificarBriefs(briefs) {
    if (briefs.length < 2) return briefs;
    let grupos = [];
    try {
      const r = await fetch('/api/unificar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefs })
      });
      if (r.ok) grupos = (await r.json()).grupos || [];
    } catch { /* si falla, se sigue con los briefs tal cual */ }
    if (!grupos.length) return briefs;

    const porTitulo = new Map(briefs.map(b => [b.titulo, b]));
    const juntos = grupos.map(g => {
      const ms = g.briefs.map(t => porTitulo.get(t)).filter(Boolean);
      if (!ms.length) return null;
      // Los campos se juntan campo a campo, sin repetir: son trozos del
      // mismo territorio vistos en páginas distintas.
      const campos = {};
      for (const [clave] of CAMPOS_BRIEF) {
        const trozos = ms.map(b => (b.campos?.[clave] || '').trim()).filter(Boolean);
        const unicos = trozos.filter((t, i, a) => a.findIndex(x => x.includes(t) || t.includes(x)) === i);
        if (unicos.length) campos[clave] = unicos.join('\n');
      }
      const texto = textoDeCampos({ campos, texto: ms.map(b => b.texto).filter((t, i, a) => a.indexOf(t) === i).join('\n') });
      // De la clase manda la mejor: si uno venía de plantilla, el
      // territorio es de plantilla.
      const plantilla = ms.some(b => b.fuente === 'plantilla');
      const conPagina = ms.find(b => b.pagina) || ms[0];
      return {
        titulo: g.nombre, campos, texto,
        documento: conPagina.documento, fichero: conPagina.fichero,
        pagina: conPagina.pagina || 0,
        fuente: plantilla ? 'plantilla' : 'territorio',
        // De dónde salió cada trozo: si el mismo mensaje está en dos
        // documentos, la tarea los cita todos.
        fuentes: [...new Set(ms.map(b => [b.documento, b.pagina].join('|')))]
          .map(k => { const [documento, pagina] = k.split('|'); return { documento, pagina: +pagina || 0 }; })
      };
    }).filter(Boolean);

    // Regla de oro: ningún brief desaparece al agrupar.
    const dentro = new Set(grupos.flatMap(g => g.briefs));
    for (const b of briefs) if (!dentro.has(b.titulo)) juntos.push(b);
    if (juntos.length > briefs.length) {
      console.error(`Unificar devolvió más briefs de los que había: ${briefs.length} → ${juntos.length}`);
      return briefs;
    }
    return juntos;
  },

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
  /* ----------------------------------------------------------
     0 ter · EL ÍNDICE DEL MES
     ----------------------------------------------------------
     Los briefs son prosa. Este paso los despliega en entradas:
     qué oferta va a qué colectivo y en qué líneas lo dice.

     Es lo que hace que la vinculación deje de depender de con
     quién le tocó ir a cada campaña en la tanda.
  ---------------------------------------------------------- */
  async construirIndice(briefs, onProgress) {
    if (!briefs.length) return [];
    const entradas = [];
    const lotes = enLotes(briefs, 12);
    let hechos = 0;

    const mandar = async lote => {
      try {
        const r = await fetch('/api/indice', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefs: lote })
        });
        if (r.ok) entradas.push(...((await r.json()).entradas || []));
      } catch { /* un lote perdido deja sus briefs sin desplegar, no rompe */ }
      hechos += lote.length;
      onProgress?.(hechos, briefs.length);
    };

    let siguiente = 0;
    const turno = async () => { while (siguiente < lotes.length) await mandar(lotes[siguiente++]); };
    await Promise.all(Array.from({ length: Math.min(3, lotes.length) }, turno));

    // Cada brief lleva SIEMPRE su entrada general, además de las
    // concretas. Al partir un brief en trozos desaparecía la opción "el
    // brief entero", y una campaña del territorio que no encajara en
    // ningún colectivo se quedaba sin nada: eSimFLAG y Deportes perdieron
    // contexto que ya tenían. Lo concreto afina; lo general cubre.
    for (const b of briefs) {
      entradas.push({
        brief: b.titulo, documento: b.documento || '', pagina: b.pagina || 0,
        fuente: b.fuente || 'territorio', producto: '', colectivo: '', oferta: '',
        distingue: '', lineas: '', general: true
      });
    }
    return entradas;
  },

  async emparejarConModelo(tasks, entradas, briefs, onProgress) {
    const campanas = tasks.map(t => ({
      pac: t.pac, name: t.name,
      producto: t.excel?.producto || '', palanca: t.excel?.palanca || '',
      subpalanca: t.excel?.subpalanca || '', medio: t.excel?.medio || '',
      objetivo: t.excel?.objetivo || '', nombreTarea: t.excel?.nombreTarea || '',
      dueDate: t.dueDate
    }));

    // Cada entrada viaja con un extracto de sus propias líneas, para que
    // se pueda comprobar sin mandar los briefs enteros. El texto bueno se
    // recupera después, aquí: el modelo no copia nada.
    const porTitulo = new Map(briefs.map(b => [b.titulo, b]));
    const conExtracto = entradas.map(e => {
      const b = porTitulo.get(e.brief);
      const texto = b ? (lineasDe(b.texto, e.lineas) || b.texto) : '';
      return { ...e, extracto: texto };
    });

    // Una campaña por llamada. Con lotes de quince, la misma campaña
    // recibía respuestas distintas según con quién le tocara ir: es un
    // juicio y el contexto de la pregunta lo movía. De una en una, la
    // respuesta depende solo de sus datos y del índice, que es idéntico
    // en todas las llamadas y por eso viaja en caché.
    const vinculos = [];
    const lotes = enLotes(campanas, 1);
    let hechos = 0;

    // Por qué falló, si falló. Sin esto, quedarse sin modelo y que el
    // modelo decida que no hay brief se veían exactamente igual.
    let fallo = '';
    const mandar = async lote => {
      try {
        const r = await fetch('/api/vincular', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campanas: lote, entradas: conExtracto })
        });
        if (r.ok) vinculos.push(...((await r.json()).vinculos || []));
        else {
          const { error } = await r.json().catch(() => ({}));
          fallo = error || `El servidor respondió ${r.status}`;
        }
      } catch (e) { fallo = e.message; }
      hechos += lote.length;
      onProgress?.(hechos, campanas.length);
    };

    // La primera va sola: deja el índice en caché y las demás lo
    // reutilizan, que es lo que abarata y acelera.
    if (lotes.length) await mandar(lotes[0]);
    let siguiente = 1;
    const turno = async () => { while (siguiente < lotes.length) await mandar(lotes[siguiente++]); };
    await Promise.all(Array.from({ length: Math.min(6, Math.max(0, lotes.length - 1)) }, turno));

    // Ninguna campaña puede quedarse sin respuesta en silencio. Una
    // tanda puede volver incompleta —pasó con PAC37488— y entonces la
    // campaña aparecía sin contexto como si el modelo hubiera decidido
    // que no le tocaba ninguno. No es lo mismo: eso hay que reintentarlo.
    for (let intento = 0; intento < 2; intento++) {
      const contestadas = new Set(vinculos.map(v => v.pac));
      const faltan = campanas.filter(c => !contestadas.has(c.pac));
      if (!faltan.length) break;
      onProgress?.(campanas.length - faltan.length, campanas.length,
        `reintentando ${faltan.length}`);
      for (const lote of enLotes(faltan, 1)) await mandar(lote);
    }

    return { vinculos, fallo };
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
     1 · DE LOS FICHEROS A LAS TAREAS
     ----------------------------------------------------------
     Cuatro pasos, en este orden:

       1. Los documentos del mes → BRIEFS (qué dice cada territorio)
       2. Los briefs → ÍNDICE (qué oferta va a qué colectivo, y en
          qué líneas lo dice)
       3. El Excel → CAMPAÑAS (determinista, ya está leído)
       4. Cada campaña → una entrada del índice

     El paso 2 es el que hace que esto sea estable. Sin él, la
     pregunta era "¿qué brief encaja con esta campaña?", un juicio
     sobre prosa que puede salir distinto dos veces. Con él, la
     pregunta es "¿qué entrada del índice corresponde a estos
     datos?", que es mucho más estrecha y se puede enseñar.

     El Excel manda siempre: ningún campo estructurado sale de los
     documentos. De ellos sale solo el mensaje, con umbral alto.
     Cada tarea declara:
       · linkConfidence: 'high' | 'low' | ausente (sin contexto — normal)
       · linkNote: por qué la vinculación es dudosa (solo si 'low')
       · description: el mensaje en sí, '' si no hay
       · contextSource: documento y página de donde sale

     Los prompts viven en src/prompts/ y son la única copia.

     Aislar aquí las llamadas al modelo permite cambiar de proveedor
     tocando solo este fichero.
  ---------------------------------------------------------- */
  async interpretarDocumentos(excelFile, strategyFiles, onProgress, opciones = {}) {
    const avisar = info => onProgress?.(info);
    avisar({ paso: 0, detalle: '', hechas: 0, total: 0 });

    // El Excel ya está leído (determinista). Los documentos se leen
    // ahora con el modelo, y después se empareja.
    if (excelFile?.parsed) {
      const tasks = JSON.parse(JSON.stringify(excelFile.parsed.tasks));
      const docs = [].concat(strategyFiles || []).filter(d => d?.texto);

      // Los mismos documentos no se releen. Cuesta cuatro minutos y,
      // peor todavía, la segunda lectura no da lo mismo que la primera:
      // el contexto de campañas que nadie ha tocado se movería solo.
      const briefs = opciones.briefs?.length
        ? opciones.briefs
        : await API.leerDocumentos(docs, p =>
            avisar({ paso: 1, hechas: p.hechas, total: p.total,
                     cuenta: `${p.doc} de ${p.docs}`,
                     detalle: p.nombre ? `Documento ${p.doc} de ${p.docs} · ${p.nombre}` : '' }));
      if (!briefs.length) {
        return { tareas: tasks, briefs: [], entradas: [], fallo: briefs.fallo || '' };
      }

      // Los briefs se despliegan en entradas: qué oferta va a qué
      // colectivo. Se guarda con la propuesta, igual que los briefs, y
      // no se recalcula si los documentos son los mismos.
      // Primero se junta lo que es el mismo territorio con otro nombre, y
      // después se despliega en entradas. En ese orden: desplegar antes
      // de juntar produce entradas duplicadas del mismo material.
      let entradas = opciones.entradas || [];
      let territorios = briefs;
      if (!entradas.length) {
        avisar({ paso: 2, hechas: 0, total: briefs.length, cuenta: '',
                 detalle: `Juntando lo que es el mismo territorio · ${briefs.length} briefs` });
        territorios = await API.unificarBriefs(briefs);
        entradas = await API.construirIndice(territorios, (hechas, total) =>
          avisar({ paso: 2, hechas, total, cuenta: `${hechas} de ${total}`,
                   detalle: `${territorios.length} territorios de ${docs.length} documentos` }));
      }

      // Cuando esto es un Excel corregido, solo se busca contexto para
      // las campañas que no estaban antes. Las demás ya lo tienen, y
      // sale de unos documentos que no han cambiado.
      const soloPacs = opciones.soloPacs;
      const pendientes = soloPacs
        ? tasks.filter(t => !t.pac || soloPacs.has(t.pac))
        : tasks;
      if (!pendientes.length) return { tareas: tasks, briefs: territorios, entradas, fallo: '' };

      const { vinculos, fallo } = await API.emparejarConModelo(pendientes, entradas, territorios,
        (hechas, total, nota) =>
          avisar({ paso: 3, hechas, total, cuenta: `${hechas} de ${total}`,
            detalle: nota || `${entradas.length} entradas en el índice del mes` }));

      const emparejadas = aplicarVinculos(pendientes, entradas, territorios, vinculos);
      // Regla de oro: toda fila del Excel acaba como tarea, con contexto
      // o sin él. Si esto no se cumple, hay un fallo que hay que ver.
      if (emparejadas.length !== pendientes.length) {
        console.error(`Se perdieron tareas: ${pendientes.length} a emparejar, ${emparejadas.length} al final`);
        return { tareas: tasks, briefs: territorios, entradas, fallo };
      }
      const porId = new Map(emparejadas.map(t => [t.id, t]));
      return { tareas: tasks.map(t => porId.get(t.id) || t), briefs: territorios, entradas, fallo };
    }
    return { tareas: JSON.parse(JSON.stringify(MOCK_TASKS)), briefs: [], entradas: [], fallo: '' };
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
    // Estrategia: aquí solo se saca el texto. Quién decide qué es
    // material de mensaje es el modelo, en el paso de lectura.
    if (file && tipo === 'strategy') {
      const texto = await ESTRATEGIA.texto(file);
      const ext = (file.name.split('.').pop() || '').toUpperCase();
      // El tamaño viaja con el documento: nombre y tamaño juntos bastan
      // para saber si es el mismo fichero de la vez anterior.
      return { name: file.name, ext, bytes: file.size, texto, briefs: [] };
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
    let mirados = 0;
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
      mirados += lote.length;
      onProgress?.({ hechas: mirados, total: pacs.length, cuenta: `${mirados} de ${pacs.length}` });
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
    // Tres lotes en vuelo, no cuatro: el Worker crea 3 tareas a la vez
    // dentro de cada lote, y Asana corta por encima de ~15 escrituras
    // simultáneas con "too many requests at the same time".
    const EN_VUELO = 3;
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
        // Que la tarea recuerde que ya está en Asana: así una
        // actualización posterior del Excel sabe que no hay que crearla
        // otra vez, solo avisar si el dato ha cambiado.
        opts.onCreada?.(res.created || []);
      }
    };
    await Promise.all(Array.from({ length: Math.min(EN_VUELO, lotes.length) }, turno));

    return { created, failed };
  }

};


// Los campos, en orden, como texto. Cada apartado abre línea con su
// etiqueta; si trae varias líneas, las demás van tal cual y también se
// pueden señalar. Si un brief no trajo campos, se queda su texto.
function textoDeCampos(b) {
  if (!b.campos || !Object.keys(b.campos).length) return b.texto || '';
  const partes = [];
  for (const [clave, etiqueta] of CAMPOS_BRIEF) {
    const v = (b.campos[clave] || '').trim();
    if (!v) continue;
    const [primera, ...resto] = v.split('\n');
    partes.push(`${etiqueta}: ${primera}`.trim());
    resto.forEach(l => l.trim() && partes.push(l.trim()));
  }
  return partes.join('\n');
}

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
  // Tipo de cliente: retirado. El Excel nunca lo traía relleno y
  // Comercialización lo ha sacado del conjunto de datos que importan
  // (29-sep-2026): quedan Palanca, Producto y Formato. Escribir un campo
  // que siempre va vacío solo ensucia la tarea.

  poner('objetivo', CATALOGS.palancaObjetivo[t.palanca]);
  poner('estado', t.estado || CATALOGS.estadoInicial);
  poner('peticionario', t.excel?.responsable);

  return {
    id: t.id,
    name: t.name,
    notes: notasDe(t),
    dueDate: t.dueDate || '',
    sectionGid: CATALOGS.sections.find(s => s.id === t.sectionId)?.gid || '',
    custom_fields: cf
  };
}


/* ------------------------------------------------------------
   LO QUE LEE QUIEN ABRE LA TAREA EN ASANA
   ------------------------------------------------------------
   Dos cosas distintas, y hacen falta las dos:

   · QUÉ ES ESTA CAMPAÑA — la columna OBJETIVO del Excel, escrita
     por quien la planificó. Es literal y determinista.
   · EL MENSAJE DEL MES — el brief del territorio.

   Un brief sirve a varias campañas: nueve de Horecas llevaban el
   mismo párrafo y eran tres trabajos distintos (un welcome pack,
   una captación y seis newsletters). Con solo el brief, quien abre
   la tarea no sabe cuál le toca. El dato estaba en el Excel: se
   usaba para emparejar y luego se tiraba.
------------------------------------------------------------- */
function notasDe(t) {
  const objetivo = (t.excel?.objetivo || '').trim();
  const contexto = (t.description || '').trim();
  const fuente = (t.contextSource || '').trim();
  const partes = [];
  if (objetivo) partes.push(`ESTA CAMPAÑA\n${objetivo}`);
  if (contexto) {
    partes.push(`ESTRATEGIA DEL MES${fuente ? ` · ${fuente}` : ''}\n${contexto}`);
  }
  return partes.join('\n\n');
}


/* ------------------------------------------------------------
   APLICAR LO QUE DECIDIÓ EL MODELO
   El modelo señala líneas del brief, no copia texto. Así no
   puede cambiar ni una coma de lo que escribió Comercialización,
   y su respuesta ocupa mucho menos, que es lo que hacía lenta
   la espera.
------------------------------------------------------------ */
// "1,4-6" → esas líneas del brief, en orden y sin repetir.
function lineasDe(texto, spec) {
  if (!spec || !/\d/.test(spec)) return '';
  const lineas = texto.split('\n');
  const quiero = new Set();
  for (const tramo of String(spec).split(',')) {
    const m = tramo.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) continue;
    const a = +m[1], b = +(m[2] || m[1]);
    for (let i = a; i <= b && i <= lineas.length; i++) if (i > 0) quiero.add(i);
  }
  const out = [...quiero].sort((x, y) => x - y).map(i => lineas[i - 1]).filter(Boolean);
  return out.length && out.length < lineas.length ? out.join('\n') : '';
}

function aplicarVinculos(tasks, entradas, briefs, vinculos) {
  const porPac = new Map(vinculos.map(v => [v.pac, v]));
  const sinRespuesta = tasks.filter(t => !porPac.has(t.pac)).length;
  if (sinRespuesta) {
    console.warn(`${sinRespuesta} campañas se quedaron sin respuesta del modelo`);
  }
  const porTitulo = new Map(briefs.map(b => [b.titulo, b]));

  return tasks.map(t => {
    const v = porPac.get(t.pac);
    // Sin respuesta no es lo mismo que sin contexto: una es un fallo y
    // la otra es el caso normal. Se distinguen en la revisión.
    if (!v) return { ...t, sinRespuesta: true };
    const e = v.entrada >= 0 ? entradas[v.entrada] : null;
    // "Ninguna encaja" es una respuesta, no un vacío. Antes se tiraba el
    // motivo y la tarea salía sin contexto y sin explicación: imposible
    // saber si el modelo tenía razón o se había equivocado.
    if (!e) return v.motivo ? { ...t, sinContextoNota: v.motivo } : t;
    const b = porTitulo.get(e.brief);
    if (!b) return t;

    return Object.assign({}, t, {
      // El texto sale de las líneas del brief, no de lo que dijo el
      // modelo: así no puede haber cambiado ni una coma.
      description: lineasDe(b.texto, e.lineas) || b.texto,
      contextSource: citaDe(e),
      contextEntrada: [e.producto, e.colectivo, e.oferta, e.distingue].filter(Boolean).join(' · '),
      linkConfidence: v.confianza === 'baja' ? 'low' : 'high',
      linkNote: v.motivo || undefined
    });
  });
}

// De dónde sale el mensaje, para que quien revise pueda abrir el
// documento por esa página y comprobarlo. "Planes Comerciales Growth y
// Value Oct 2026 · SLIDE 12". Sin página, solo el documento.
function citaDe(e) {
  const doc = (e.documento || '').trim();
  if (!doc) return e.brief || '';
  return e.pagina ? `${doc} · SLIDE ${e.pagina}` : doc;
}
