/* ============================================================
   Campaign Loader · Lector del Excel de Comercialización
   ------------------------------------------------------------
   Determinista. Sin IA, sin Asana. Convierte el .xlsx en Tarea[]
   usando las tablas de data.js → EXCEL, y devuelve avisos de
   todo lo que no ha podido mapear con seguridad.

   Depende de SheetJS (XLSX global) y de data.js.
   Suciedad conocida del fichero: DECISIONES.md → "Lo que sabemos
   del Excel real".
============================================================ */

const EXCEL_PARSER = (() => {

  const MESES = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12
  };

  const clean = v => (v == null ? '' : String(v)).replace(/ /g, ' ').trim();

  // '21-sep.-2026' | '21/9/26' | Date → 'YYYY-MM-DD'. '' si no se entiende.
  function parseFecha(v) {
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    const s = clean(v).toLowerCase();
    let m = s.match(/^(\d{1,2})-([a-z]+)\.?-(\d{4})$/);
    if (m && MESES[m[2]]) return `${m[3]}-${pad(MESES[m[2]])}-${pad(m[1])}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${y}-${pad(m[2])}-${pad(m[1])}`;
    }
    return '';
  }
  const pad = n => String(n).padStart(2, '0');

  // Localiza cada columna por su cabecera, tolerando espacios y saltos.
  function mapColumns(headerRow) {
    const norm = s => clean(s).replace(/\s+/g, ' ').toLowerCase();
    const idx = {};
    for (const [key, header] of Object.entries(EXCEL.columns)) {
      const want = norm(header);
      const i = headerRow.findIndex(h => norm(h) === want);
      if (i >= 0) idx[key] = i;
    }
    return idx;
  }

  function parse(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[EXCEL.sheet] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

    const warnings = [];
    const warn = (tipo, fila, msg) => warnings.push({ tipo, fila, msg });

    const idx = mapColumns(rows[0] || []);
    const faltan = ['nombre', 'medio', 'palanca', 'producto', 'fechaInicio']
      .filter(k => idx[k] == null);
    if (faltan.length) {
      warn('cabecera', 1, `No encuentro las columnas: ${faltan.join(', ')}`);
      return { tasks: [], warnings, meta: { filas: 0 } };
    }
    const col = (r, k) => (idx[k] == null ? null : r[idx[k]]);

    const tasks = [];
    const vistos = new Set();
    const omitidas = {};   // palanca → nº de filas no importadas

    rows.slice(1).forEach((r, i) => {
      const fila = i + 2;
      const nombre = clean(col(r, 'nombre'));
      if (!nombre) return; // fila vacía o de relleno (fórmulas sin datos)

      // PAC: del nombre, no de la columna B (que es una fórmula sobre E).
      const m = nombre.match(EXCEL.pacPattern);
      const pac = m ? m[0] : '';
      if (!pac) warn('pac', fila, `El nombre no empieza por PAC: "${nombre.slice(0, 40)}"`);
      else if (vistos.has(pac)) warn('pac', fila, `${pac} repetido (se esperaba 1 fila = 1 PAC)`);
      vistos.add(pac);

      const medio = clean(col(r, 'medio'));
      const palanca = clean(col(r, 'palanca'));
      if (EXCEL.palancasOmitidas.includes(palanca)) {
        omitidas[palanca] = (omitidas[palanca] || 0) + 1;
        return;
      }
      const producto = clean(col(r, 'producto'));
      const viabilidad = clean(col(r, 'viabilidad'));
      const tsk = clean(col(r, 'tsk'));

      const product = EXCEL.productoProduct[producto];
      if (!product) warn('producto', fila, `Producto sin mapear: "${producto}"`);

      let format = EXCEL.medioFormat[medio];
      if (!format) warn('medio', fila, `Medio sin mapear: "${medio}"`);
      if (EXCEL.productoFormatOverride[producto]) format = EXCEL.productoFormatOverride[producto];

      const typology = EXCEL.palancaTypology[palanca];
      if (!typology) warn('palanca', fila, `Palanca sin mapear: "${palanca}"`);

      const dueDate = parseFecha(col(r, 'fechaInicio'));
      if (!dueDate) warn('fecha', fila, `Fecha no reconocida: "${clean(col(r, 'fechaInicio'))}"`);

      if (/PDTE/i.test(tsk)) warn('tsk', fila, `${pac || nombre.slice(0, 20)} sin TSK asignado`);

      tasks.push({
        id: pac || `fila${fila}`,
        pac,
        tsk,
        name: nombre,
        product: product || 'Otros',
        sectionId: CATALOGS.productSectionMap[product || 'Otros'],
        format: format || CATALOGS.formatOptions[0],
        dueDate,
        typology: typology || 'Growth',
        clientType: '',                       // no viene en el Excel (regla 1)
        estado: EXCEL.viabilidadEstado[viabilidad] || CATALOGS.estadoInicial,
        description: '',                      // solo lo rellena el PDF
        // Datos del Excel que no tienen campo en la UI todavía
        excel: {
          fila, medio, palanca, producto, viabilidad,
          subpalanca: clean(col(r, 'subpalanca')),
          objetivo: clean(col(r, 'objetivo')),
          responsable: clean(col(r, 'responsable')),
          po: clean(col(r, 'po')),            // unidad sin confirmar; solo texto
          mes: col(r, 'mes'),
          semana: col(r, 'semana')
        }
      });
    });

    return {
      tasks,
      warnings,
      meta: {
        filas: tasks.length,
        pacs: vistos.size,
        omitidas,
        hoja: ws === wb.Sheets[EXCEL.sheet] ? EXCEL.sheet : wb.SheetNames[0]
      }
    };
  }

  return { parse, parseFecha };
})();
