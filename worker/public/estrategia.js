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
      const lineas = juntar ? registro(paginas[i - 1]).concat(registro(p)) : registro(p);
      if (lineas.length) out.push({ pagina: i + 1, titulo: t, texto: lineas.join('\n') });
    });
    return out;
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
        filas.get(y).push([it.transform[4], it.str]);
      }
      const lineas = [...filas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, frags]) => frags.sort((a, b) => a[0] - b[0]).map(f => f[1]).join('').trim())
        .filter(Boolean);
      paginas.push(lineas.join('\n'));
    }
    return paginas;
  }

  async function parse(file) {
    try {
      const paginas = await extraer(file);
      return { briefs: briefs(paginas), paginas: paginas.length };
    } catch (e) {
      // El documento no puede romper la carga: sin briefs, sin ruido.
      return { briefs: [], paginas: 0 };
    }
  }

  // Vincula cada tarea con su brief. Tabla explícita producto → brief:
  // umbral alto, prefiere no encontrar a encontrar mal.
  function vincular(tasks, briefs) {
    if (!briefs.length) return tasks;
    const porTitulo = {};
    for (const b of briefs) porTitulo[b.titulo.slice(0, 22).toLowerCase()] = b;

    return tasks.map(t => {
      const clave = EXCEL.productoBrief[t.excel?.producto];
      if (!clave) return t;
      // Una entrada puede declarar varios briefs candidatos. Si el
      // documento trae más de uno, la vinculación es dudosa: se pega el
      // primero y la tarea sale en amarillo para que alguien la mire.
      const candidatos = [].concat(clave)
        .map(c => porTitulo[c.slice(0, 22).toLowerCase()])
        .filter(Boolean);
      if (!candidatos.length) return t;
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
    });
  }

  return { parse, vincular };
})();
