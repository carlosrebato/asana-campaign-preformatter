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

  // Texto libre del Excel. Hay celdas que traen un "0" de relleno, de
  // arrastrar una fórmula o de un desplegable sin tocar. Un cero no es un
  // objetivo de campaña: acababa impreso en la tarea como
  // "ESTA CAMPAÑA: 0", que no dice nada y encima parece un fallo.
  const libre = v => {
    const t = clean(v);
    return /^(0|-|n\/?a)$/i.test(t) ? '' : t;
  };

  // '21-sep.-2026' | '21/9/26' | Date → 'YYYY-MM-DD'. '' si no se entiende.
  function parseFecha(v) {
    // Ojo: NO usar toISOString(). Cuando la celda es una fecha de verdad,
    // Excel la da a medianoche local; pasarla a UTC la echa al día
    // anterior y la tarea entra en Asana con un día menos, sin avisar.
    if (v instanceof Date && !isNaN(v)) {
      return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    }
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

  /* ----------------------------------------------------------
     NOMBRE DEL RESPONSABLE → CORREO CORPORATIVO
     ----------------------------------------------------------
     El Excel dice "INES MOLINERO MARTIN"; Asana guarda
     "ines.molineromartin@telefonica.com". La regla y las pruebas
     están en data.js → "El peticionario es un correo, no un nombre".

     Devuelve { correo, aviso }. Nunca inventa: si el nombre no
     tiene la forma de siempre, devuelve el correo igual pero
     diciendo que hay que mirarlo.
  ---------------------------------------------------------- */
  const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
                          .replace(/ñ/g, 'n').replace(/Ñ/g, 'N');

  function correoDe(nombre) {
    const partes = clean(nombre).toLowerCase().split(/\s+/).filter(Boolean);
    if (!partes.length) return { correo: '', aviso: '' };

    const particula = p => CATALOGS.correoParticulas.includes(sinTildes(p));

    // Los apellidos se cuentan desde el final. Un apellido es una
    // palabra más las partículas que la preceden: en "MARIN DE LAS
    // HERAS", "DE LAS HERAS" es UN apellido, no tres.
    let i = partes.length;
    let contados = 0;
    while (i > 0 && contados < CATALOGS.correoApellidos) {
      i--;                                   // la palabra del apellido
      while (i > 0 && particula(partes[i - 1])) i--;   // y sus partículas
      contados++;
    }

    const nombres = partes.slice(0, i);
    const apellidos = partes.slice(i);
    const pegar = xs => sinTildes(xs.join('')).replace(/[^a-z0-9]/g, '');

    // Con menos de tres palabras no hay dos apellidos que contar: se
    // hace lo que se puede y se avisa, porque el correo puede no ser ese.
    if (!nombres.length || contados < CATALOGS.correoApellidos) {
      const todo = pegar(partes);
      return {
        correo: todo ? todo + CATALOGS.correoDominio : '',
        aviso: `"${clean(nombre)}" no tiene nombre y dos apellidos; el correo puede no ser correcto`
      };
    }
    return { correo: pegar(nombres) + '.' + pegar(apellidos) + CATALOGS.correoDominio, aviso: '' };
  }

  // Localiza cada columna por su cabecera, tolerando espacios y saltos.
  // Todos los formatos de Asana que aparecen en una celda de MEDIO,
  // sin repetir y en el orden en que se reconocen.
  function formatosDe(medio) {
    const t = clean(medio).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[_/+,;&]/g, ' ');
    const out = [];
    for (const [patron, formato] of EXCEL.medioFragmentos) {
      if (patron.test(t) && !out.includes(formato)) out.push(formato);
    }
    return out;
  }

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

      const subpalanca = clean(col(r, 'subpalanca'));
      // Producto y sección. El caso normal es el catálogo; "Info" se
      // reconoce por el nombre, y unos pocos productos tienen sección
      // propia en Asana (Horecas, Enews Marca, Enews Entretenimiento).
      const porNombre = producto === 'Info'
        && EXCEL.productoPorNombre.find(x => x.pattern.test(nombre));
      const product = porNombre ? porNombre.product : EXCEL.productoProduct[producto];
      if (!product) warn('producto', fila, `Producto sin mapear: "${producto}"`);
      const sectionId = (porNombre && porNombre.section)
        || EXCEL.productoSection[producto]
        || CATALOGS.productSectionMap[product || 'Otros']
        || 'otros';

      // El medio puede traer varios canales en la misma celda. Se
      // buscan todos los que se reconozcan; si apuntan al mismo formato
      // de Asana (el caso de e-Mailing + SMS) no hay nada que decidir.
      const formatos = formatosDe(medio);
      let format = formatos[0];
      if (!format) warn('medio', fila, `Medio sin reconocer: "${medio}"`);
      else if (formatos.length > 1) {
        warn('medio', fila,
          `"${medio}" mezcla ${formatos.length} formatos (${formatos.join(' + ')}). ` +
          `Se ha puesto "${format}"; revísalo.`);
      }
      if (EXCEL.productoFormatOverride[producto]) format = EXCEL.productoFormatOverride[producto];

      const typology = EXCEL.palancaTypology[palanca];
      if (!typology) warn('palanca', fila, `Palanca sin mapear: "${palanca}"`);

      const dueDate = parseFecha(col(r, 'fechaInicio'));
      if (!dueDate) warn('fecha', fila, `Fecha no reconocida: "${clean(col(r, 'fechaInicio'))}"`);

      if (/PDTE/i.test(tsk)) warn('tsk', fila, `${pac || nombre.slice(0, 20)} sin TSK asignado`);

      // El peticionario que Asana guarda es el correo, no el nombre.
      const responsable = clean(col(r, 'responsable'));
      const { correo, aviso } = correoDe(responsable);
      if (aviso) warn('peticionario', fila, aviso);

      tasks.push({
        id: pac || `fila${fila}`,
        pac,
        tsk,
        name: nombre,
        product: product || 'Otros',
        sectionId,
        format: format || CATALOGS.formatOptions[0],
        dueDate,
        typology: typology || 'Growth',
        clientType: '',                       // no viene en el Excel (regla 1)
        palanca,                              // sí viene siempre, y se escribe en Asana
        estado: CATALOGS.estadoInicial,   // Asana no distingue Aprobada/Planificada
        description: '',                      // solo lo rellena el PDF
        // Datos del Excel que no tienen campo en la UI todavía
        excel: {
          fila, medio, palanca, producto, viabilidad,
          subpalanca,
          objetivo: libre(col(r, 'objetivo')),
          nombreTarea: libre(col(r, 'nombreTarea')),
          responsable,
          peticionario: correo,
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
