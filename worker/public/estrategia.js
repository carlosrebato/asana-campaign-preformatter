/* ============================================================
   Campaign Loader · Texto de los documentos de estrategia
   ------------------------------------------------------------
   Este fichero SOLO saca texto. Nada de decidir qué es un brief
   ni qué es ruido: eso lo hace el modelo (prompts/lectura.md).

   Aquí vivía un extractor que buscaba "idea fuerza", "tono" y
   "reason why" con expresiones regulares. Funcionaba con el
   documento de octubre y se habría roto con el de noviembre,
   porque cada mes los escribe otro equipo y con otro formato.
   Reconocer material de mensaje en un documento que cambia no
   se puede resolver con reglas: es el trabajo del modelo.

   Depende de pdf.js para los PDF. El HTML se lee del propio
   documento. Si un fichero viene ilegible se devuelve texto
   vacío y las tareas salen sin contexto, que es un estado
   normal (DECISIONES.md, regla 4).
============================================================ */

const ESTRATEGIA = (() => {

  async function textoPdf(file) {
    const pdfjs = await import('./vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const items = (await (await doc.getPage(n)).getTextContent()).items;
      // Reconstruir líneas por altura, respetando los huecos entre
      // cajas de texto: pdf.js entrega fragmentos sueltos.
      const filas = new Map();
      for (const it of items) {
        if (!it.str) continue;
        const y = Math.round(it.transform[5]);
        if (!filas.has(y)) filas.set(y, []);
        filas.get(y).push({ x: it.transform[4], w: it.width || 0, s: it.str, cuerpo: Math.abs(it.transform[3]) || 10 });
      }
      const lineas = [...filas.entries()].sort((a, b) => b[0] - a[0])
        .map(([, frags]) => frags.sort((a, b) => a.x - b.x).reduce((acc, f, i, arr) => {
          if (i === 0) return f.s;
          const prev = arr[i - 1];
          const hueco = f.x - (prev.x + prev.w) > f.cuerpo * 0.28;
          const pegado = /\s$/.test(acc) || /^\s/.test(f.s);
          return acc + (hueco && !pegado ? ' ' : '') + f.s;
        }, '').trim())
        .filter(Boolean);
      // La página va marcada en el propio texto. Es lo que luego permite
      // citar "SLIDE 12" en la tarea: sin esto, el modelo puede decirte
      // de qué documento sale un mensaje, pero no de dónde.
      paginas.push(`[PÁGINA ${n}]\n${lineas.join('\n')}`);
    }
    return paginas.join('\n\f\n');
  }

  async function textoHtml(file) {
    const crudo = await file.text();
    const doc = new DOMParser().parseFromString(crudo, 'text/html');
    doc.querySelectorAll('style, link, svg').forEach(n => n.remove());
    // Algunos documentos guardan su contenido en variables del propio
    // HTML en vez de en la maqueta. Los scripts se conservan como texto
    // para que el modelo pueda leerlo.
    const visible = doc.body ? doc.body.innerText || doc.body.textContent : '';
    const datos = [...doc.querySelectorAll('script')]
      .map(s => s.textContent).filter(t => t && t.length > 400).join('\n');
    return `${visible}\n${datos}`.replace(/\n{3,}/g, '\n\n').trim();
  }

  async function texto(file) {
    try {
      if (/\.html?$/i.test(file.name)) return await textoHtml(file);
      return await textoPdf(file);
    } catch {
      return '';   // un documento ilegible no puede romper la carga
    }
  }

  // El modelo se pierde con documentos enteros: hay que dárselo por
  // partes. Se corta por páginas, que es donde el documento ya tiene
  // sus propias costuras.
  function trozos(t, max = 15000) {
    const partes = t.split('\f');
    const out = [];
    let actual = '';
    for (const p of partes) {
      if (actual && (actual.length + p.length) > max) { out.push(actual); actual = ''; }
      actual += (actual ? '\n' : '') + p;
      while (actual.length > max * 1.6) { out.push(actual.slice(0, max)); actual = actual.slice(max); }
    }
    if (actual.trim()) out.push(actual);
    return out.filter(x => x.trim().length > 200);
  }

  return { texto, trozos };
})();
