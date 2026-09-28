/* ============================================================
   Campaign Loader · Lector del documento de estrategia
   ------------------------------------------------------------
   Determinista. Sin IA. Extrae del PDF los BRIEFS DE MENSAJE que
   escribió Comercialización y los vincula a las campañas del Excel.

   Dos ideas, las dos de DECISIONES.md:

   · El brief se reconoce por ETIQUETAS ("idea fuerza", "jerarquía",
     "tono", "reason why", "mensaje"), no por maquetación. El mismo
     documento trae tres formatos distintos y el formato cambia cada
     mes: cualquier regla de layout se rompe en la siguiente entrega.

   · Del brief solo se copia el REGISTRO DE MENSAJE — lo que le habla
     al cliente. Target, objetivo de negocio, contexto, hitos y
     planificación se descartan: son segmentación y plan, que ya están
     en el Excel o no son asunto de la tarea.

   El texto se copia LITERAL. Nadie lo resume ni lo reescribe: el
   objetivo es recuperar el brief que Comercialización ya escribió.

   Depende de pdf.js. Si el PDF viene ilegible, devuelve cero briefs
   y las tareas salen sin contexto, que es un estado normal.
============================================================ */

const ESTRATEGIA = (() => {

  // Etiquetas que abren material de mensaje.
  const ENTRA = /(idea\s*fuerza|elevator\s*pitch|mensaje\s*(principal|secundario)|jerarqu[ií]a|tono|reason\s*why)/i;
  // Etiquetas que lo cierran: a partir de aquí ya no le habla al cliente.
  const FUERA = /(target|objetivo\s*de\s*negocio|planificaci[óo]n|contexto|oportunidad|hitos|restricciones)/i;
  // Encabezado de sección numerada ("5. Elevator Pitch:"), que no aporta.
  const RUIDO = /^\d+\.\s*elevator\s*pitch:?$/i;

  const limpiar = l => l.replace(/^[\s•▪\-–]+/, '').trim();

  function registro(pagina) {
    const out = [];
    let dentro = false;
    for (const linea of pagina.split('\n')) {
      const t = limpiar(linea);
      if (!t) continue;
      const cabeza = t.slice(0, 40);
      if (ENTRA.test(cabeza)) { dentro = true; if (!RUIDO.test(t)) out.push(t); continue; }
      if (FUERA.test(cabeza)) { dentro = false; continue; }
      if (dentro) out.push(t);
    }
    return out;
  }

  // El PDF parte los párrafos por el ancho de la diapositiva, y a veces el
  // corte cae entre dos páginas. Una línea que empieza en minúscula detrás
  // de otra que no ha terminado la frase es la misma frase.
  function unirPartidas(lineas) {
    return lineas.reduce((acc, t) => {
      const anterior = acc[acc.length - 1];
      if (anterior && !/[.:;]$/.test(anterior) && /^[a-záéíóúñ(]/.test(t)) {
        acc[acc.length - 1] = `${anterior} ${t}`;
      } else acc.push(t);
      return acc;
    }, []);
  }

  function titulo(pagina) {
    for (const l of pagina.split('\n')) {
      const t = l.trim();
      if (t && !/^[\d•▪]/.test(t)) return t;
    }
    return '';
  }

  // Un brief puede ocupar dos páginas seguidas del mismo tema.
  function briefs(paginas) {
    const out = [];
    paginas.forEach((p, i) => {
      if (!/reason\s*why/i.test(p)) return;
      const t = titulo(p);
      const juntar = i > 0 && titulo(paginas[i - 1]).slice(0, 18).toLowerCase() === t.slice(0, 18).toLowerCase();
      const crudas = juntar ? registro(paginas[i - 1]).concat(registro(p)) : registro(p);
      const lineas = unirPartidas(crudas);
      if (lineas.length) out.push({ pagina: i + 1, titulo: t, texto: lineas.join('\n') });
    });
    return out;
  }

  /* ---------- HTML: el documento de orientación ----------
     No trae la plantilla de Comercialización, pero sí 21 fichas por
     territorio con idea dominante, tono, qué evitar y verbalizaciones.
     Eso es registro de mensaje: le habla al cliente. Lo que es registro
     de planner —objetivo, tensión, audiencia, misión por soporte— se
     descarta igual que en los PDF.

     Los datos viven en una variable del propio HTML, así que se leen de
     ahí y no de la maqueta: si cambia el diseño, esto sigue valiendo.
  ---------------------------------------------------------- */
  const CAMPOS_TERRITORIO = [
    ['d',   'Idea dominante'],
    ['ton', 'Tono'],
    ['pri', 'Principio'],
    ['exp', 'Por dónde explorar'],
    ['evi', 'Qué evitar']
  ];

  function recortarArray(texto, desde) {
    let prof = 0;
    for (let i = desde; i < texto.length; i++) {
      if (texto[i] === '[') prof++;
      else if (texto[i] === ']' && --prof === 0) return texto.slice(desde, i + 1);
    }
    return '';
  }

  function territorios(html) {
    const m = html.match(/TERR\s*=\s*\[/);
    if (!m) return [];
    let lista;
    try { lista = JSON.parse(recortarArray(html, m.index + m[0].length - 1)); }
    catch { return []; }

    return lista.map(t => {
      const lineas = [];
      for (const [clave, etiqueta] of CAMPOS_TERRITORIO) {
        if (t[clave]) lineas.push(`${etiqueta}: ${t[clave]}`);
      }
      if (Array.isArray(t.ver) && t.ver.length) {
        lineas.push('Verbalizaciones: ' + t.ver.map(v => v.replace(/^Territorio:\s*/, '')).join(' · '));
      }
      if (Array.isArray(t.man) && t.man.length) {
        lineas.push('Mandatorios: ' + t.man.map(x => x.t || x).join(' · '));
      }
      return lineas.length
        ? { pagina: 0, titulo: t.n || t.t || '', texto: lineas.join('\n'), fuente: 'territorio' }
        : null;
    }).filter(Boolean);
  }

  async function extraer(file) {
    const pdfjs = await import('./vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const items = (await (await doc.getPage(n)).getTextContent()).items;
      // Reconstruir líneas por posición vertical: pdf.js entrega fragmentos.
      const filas = new Map();
      for (const it of items) {
        if (!it.str) continue;
        const y = Math.round(it.transform[5]);
        if (!filas.has(y)) filas.set(y, []);
        filas.get(y).push({
          x: it.transform[4], w: it.width || 0, s: it.str,
          cuerpo: Math.abs(it.transform[3]) || 10
        });
      }
      // Dos cajas de texto distintas a la misma altura son dos palabras
      // distintas: si hay hueco entre ellas, va un espacio.
      const lineas = [...filas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, frags]) => frags.sort((a, b) => a.x - b.x).reduce((acc, f, i, arr) => {
          if (i === 0) return f.s;
          const prev = arr[i - 1];
          // Un hueco solo es un espacio si mide como un espacio. Con un
          // umbral fijo se partían palabras que el PDF trae en dos trozos.
          const hueco = f.x - (prev.x + prev.w) > f.cuerpo * 0.28;
          const pegado = /\s$/.test(acc) || /^\s/.test(f.s);
          return acc + (hueco && !pegado ? ' ' : '') + f.s;
        }, '').trim())
        .filter(Boolean);
      paginas.push(lineas.join('\n'));
    }
    return paginas;
  }

  async function parse(file) {
    try {
      if (/\.html?$/i.test(file.name)) {
        const t = territorios(await file.text());
        return { briefs: t, paginas: t.length };
      }
      const paginas = await extraer(file);
      return { briefs: briefs(paginas).map(b => ({ ...b, fuente: 'plantilla' })), paginas: paginas.length };
    } catch (e) {
      // El documento no puede romper la carga: sin briefs, sin ruido.
      return { briefs: [], paginas: 0 };
    }
  }

  // Vincula cada tarea con su brief. Tabla explícita producto → brief:
  // umbral alto, prefiere no encontrar a encontrar mal.
  function vincular(tasks, briefs) {
    if (!briefs.length) return tasks;
    const porTitulo = (fuente) => {
      const m = {};
      for (const b of briefs.filter(b => b.fuente === fuente)) {
        m[b.titulo.slice(0, 22).toLowerCase()] = b;
      }
      return m;
    };
    const plantillas = porTitulo('plantilla');
    const territorios = porTitulo('territorio');

    return tasks.map(t => {
      const producto = t.excel?.producto;

      // 1 · El brief de Comercialización manda: es el material original.
      const clave = EXCEL.productoBrief[producto];
      if (clave) {
        const candidatos = [].concat(clave)
          .map(c => plantillas[c.slice(0, 22).toLowerCase()])
          .filter(Boolean);
        if (candidatos.length) {
          const b = candidatos[0];
          const dudoso = candidatos.length > 1;
          return Object.assign({}, t, {
            description: b.texto,
            contextSource: `${b.titulo} (pág. ${b.pagina})`,
            linkConfidence: dudoso ? 'low' : 'high',
            linkNote: dudoso
              ? `El documento trae ${candidatos.length} briefs que encajan con este producto `
                + `(${candidatos.map(c => c.titulo).join(' · ')}) y el Excel no dice cuál. `
                + 'Se ha pegado el primero.'
              : undefined
          });
        }
      }

      // 2 · Sin brief, el territorio del documento de orientación. Es
      // material derivado, no el brief original: vinculación dudosa a
      // propósito, para que alguien lo mire antes de cargarlo.
      const terr = EXCEL.productoTerritorio[producto];
      const b = terr && territorios[terr.slice(0, 22).toLowerCase()];
      if (b) {
        return Object.assign({}, t, {
          description: b.texto,
          contextSource: `Territorio · ${b.titulo}`,
          linkConfidence: 'low',
          linkNote: 'Sale del documento de orientación, no del brief de '
            + 'Comercialización. Es material derivado: conviene leerlo antes de cargar.'
        });
      }
      return t;
    });
  }

  return { parse, vincular };
})();
