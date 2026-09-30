/* ============================================================
   Campaign Loader · Lector del Excel de banners de Movistar Plus+
   ------------------------------------------------------------
   Determinista. Sin IA, sin Asana, sin coste. Convierte la
   parrilla de banners en Tarea[], con la misma forma que las
   tareas del Excel de Comercialización, y devuelve avisos de
   todo lo que no ha podido decidir solo.

   La diferencia con excel.js es de fondo: allí el dato está en
   el texto de la celda, aquí está en su COLOR. Verde es una
   creatividad nueva y por tanto una tarea; blanco es una
   creatividad que se reutiliza y no hay nada que pedir.

   Depende de SheetJS (XLSX global) y de data.js → BANNERS.
============================================================ */

const BANNERS_PARSER = (() => {

  const limpio = v => (v == null ? '' : String(v)).replace(/ /g, ' ').trim();
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /* ----------------------------------------------------------
     EL COLOR DE LA CELDA
     ----------------------------------------------------------
     SheetJS devuelve el relleno de dos maneras según cómo lo
     guardó Excel: un rgb directo, o un índice del tema del libro
     más un matiz. Las dos hay que resolverlas al color final, o
     se pierden celdas: en el fichero de octubre, 52 de las 216
     celdas de la parrilla vienen por tema.
  ---------------------------------------------------------- */

  // Tema del libro, en el orden en que lo indexan los estilos.
  function paleta(wb) {
    const esquema = wb?.Themes?.themeElements?.clrScheme;
    if (!Array.isArray(esquema)) return [];
    return esquema.map(c => limpio(c.rgb).slice(-6).toUpperCase());
  }

  // Un matiz aclara (matiz > 0) u oscurece (matiz < 0) el color del tema.
  function matizar(hexa, matiz) {
    const canal = i => parseInt(hexa.slice(i * 2, i * 2 + 2), 16);
    const f = matiz > 0
      ? c => c * (1 - matiz) + 255 * matiz
      : matiz < 0 ? c => c * (1 + matiz) : c => c;
    return [0, 1, 2].map(i => Math.round(f(canal(i))));
  }

  function colorDe(celda, tema) {
    const fg = celda?.s?.patternType && celda.s.patternType !== 'none'
      ? celda.s.fgColor : null;
    if (!fg) return null;
    const matiz = typeof fg.tint === 'number' ? fg.tint : 0;
    if (fg.rgb) {
      const h = limpio(fg.rgb).slice(-6).toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(h)) return null;
      // Cuando SheetJS ya ha resuelto el tema, el rgb viene con el matiz
      // aplicado. Solo se matiza lo que llega crudo.
      return fg.theme != null ? [0, 1, 2].map(i => parseInt(h.slice(i * 2, i * 2 + 2), 16))
                              : matizar(h, matiz);
    }
    if (fg.theme != null && tema[fg.theme]) return matizar(tema[fg.theme], matiz);
    return null;
  }

  // ¿De qué familia es este color? Se pregunta por el TONO, no por el
  // color exacto: en octubre hay tres verdes distintos (#DAF2D0,
  // #DCEDD5, #D1E1D3) y comparar contra una lista perdía tareas.
  function familia(rgb) {
    if (!rgb) return 'sin pintar';
    const [r, g, b] = rgb;
    if (r > 246 && g > 246 && b > 246) return 'blanco';
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === min) return 'gris';
    const saturacion = (max - min) / (255 - Math.abs(max + min - 255));
    if (saturacion < 0.12) return 'gris';
    let tono;
    if (max === r)      tono = ((g - b) / (max - min)) % 6;
    else if (max === g) tono = (b - r) / (max - min) + 2;
    else                tono = (r - g) / (max - min) + 4;
    tono = (tono * 60 + 360) % 360;
    return (tono >= 70 && tono <= 175) ? 'verde' : 'otro';
  }

  const hex = rgb => rgb ? '#' + rgb.map(c => pad(c.toString(16)).toUpperCase().slice(-2)).join('') : '';

  /* ----------------------------------------------------------
     FECHAS
     ----------------------------------------------------------
     La semana la da la cabecera ('S41'), y la franja dice si el
     banner entra el lunes o el jueves. La entrega al Plus son
     n-3 laborables antes, saltando fines de semana y festivos.
  ---------------------------------------------------------- */

  // Lunes de una semana ISO. Sin horas: con horas, el cambio de hora de
  // octubre movía la fecha un día.
  function lunesDe(anio, semana) {
    const d = new Date(anio, 0, 4);                 // el 4-ene está siempre en la semana 1
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // su lunes
    d.setDate(d.getDate() + (semana - 1) * 7);
    return d;
  }

  function semanaIsoDe(f) {
    const d = new Date(f.getFullYear(), f.getMonth(), f.getDate());
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));  // jueves de su semana
    const enero4 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - enero4) / 86400000 - 3 + ((enero4.getDay() + 6) % 7)) / 7);
  }

  function laborable(f, festivos) {
    const dia = f.getDay();
    return dia !== 0 && dia !== 6 && !festivos.has(iso(f));
  }

  function restarLaborables(f, dias, festivos) {
    const d = new Date(f);
    let quedan = dias;
    while (quedan > 0) {
      d.setDate(d.getDate() - 1);
      if (laborable(d, festivos)) quedan--;
    }
    return d;
  }

  /* ----------------------------------------------------------
     DÓNDE ESTÁ CADA COSA EN LA PARRILLA
  ---------------------------------------------------------- */

  // Las celdas combinadas guardan el valor solo en su esquina. Quien
  // pregunte por cualquier otra celda del grupo tiene que recibir lo
  // mismo: si no, la mitad de las franjas J-D salen sin producto.
  function ancla(ws) {
    const mapa = new Map();
    for (const m of ws['!merges'] || []) {
      const raiz = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          mapa.set(XLSX.utils.encode_cell({ r, c }), raiz);
        }
      }
    }
    return mapa;
  }

  function hojaDe(wb) {
    const ocultas = new Set(
      (wb.Workbook?.Sheets || [])
        .filter(h => h && h.Hidden)
        .map(h => h.name));
    const visibles = wb.SheetNames.filter(n => !ocultas.has(n));
    const candidatas = visibles.length ? visibles : wb.SheetNames;
    return candidatas.find(n => BANNERS.hojaPatron.test(n)) || candidatas[0];
  }

  // El año no está en ninguna celda: está en el nombre de la hoja
  // ('OCT_26_Banners Ms') o del fichero. Se saca de ahí y después se
  // comprueba contra la propia parrilla, que es la única garantía de
  // que no hemos fechado el mes en el año que no era.
  function anioDe(textos) {
    for (const t of textos) {
      const m = limpio(t).match(/\b(20\d\d)\b/) || limpio(t).match(/\b_?(\d\d)\b(?!\d)/);
      if (!m) continue;
      const n = +m[1];
      const anio = n > 100 ? n : 2000 + n;
      if (anio >= 2020 && anio <= 2099) return anio;
    }
    return null;
  }

  /* ----------------------------------------------------------
     LECTURA
  ---------------------------------------------------------- */

  function parse(arrayBuffer, nombreFichero = '') {
    const avisos = [];
    const avisar = (tipo, donde, msg) => avisos.push({ tipo, fila: donde, msg });

    const wb = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true, cellDates: true });
    const nombreHoja = hojaDe(wb);
    const ws = wb.Sheets[nombreHoja];
    if (!ws || !ws['!ref']) {
      avisar('hoja', 0, `La hoja "${nombreHoja}" viene vacía`);
      return { tasks: [], warnings: avisos, meta: { hoja: nombreHoja, verdes: 0 } };
    }

    const tema = paleta(wb);
    const raices = ancla(ws);
    const rango = XLSX.utils.decode_range(ws['!ref']);
    const en = (r, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      return ws[raices.get(ref) || ref];
    };
    const texto = (r, c) => limpio(en(r, c)?.v).replace(/\s*\n\s*/g, ' ');

    // --- Columnas de semana, por su cabecera S40/S41/…
    const semanas = [];
    for (let r = rango.s.r; r <= Math.min(rango.s.r + 6, rango.e.r); r++) {
      for (let c = rango.s.c; c <= rango.e.c; c++) {
        const m = texto(r, c).match(BANNERS.semanaPatron);
        if (m && !semanas.some(s => s.col === c)) {
          semanas.push({ col: c, num: +m[1], filaCabecera: r, rotulo: texto(r + 1, c) });
        }
      }
      if (semanas.length) break;
    }
    if (!semanas.length) {
      avisar('cabecera', 1, 'No encuentro las columnas de semana (se esperaba una cabecera tipo "S40")');
      return { tasks: [], warnings: avisos, meta: { hoja: nombreHoja, verdes: 0 } };
    }
    semanas.sort((a, b) => a.col - b.col);

    // --- Año, y comprobación contra la propia parrilla
    const anio = anioDe([nombreHoja, nombreFichero]);
    if (!anio) {
      avisar('anio', 1,
        `No sé de qué año es este fichero: ni la hoja ("${nombreHoja}") ni el nombre del ` +
        `fichero lo dicen. Las tareas saldrán sin fecha.`);
    } else {
      // El rótulo de la semana ('5-11 octubre') tiene que caer dentro de
      // la semana que dice la cabecera. Si no, el año está mal.
      for (const s of semanas) {
        const m = s.rotulo.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*([a-záéíóú]+)/i);
        if (!m) continue;
        const lunes = lunesDe(anio, s.num);
        const dias = [0, 1, 2, 3, 4, 5, 6].map(i => {
          const d = new Date(lunes); d.setDate(d.getDate() + i); return d.getDate();
        });
        if (!dias.includes(+m[1])) {
          avisar('anio', s.filaCabecera + 1,
            `La semana ${s.num} de ${anio} empieza el ${lunes.getDate()}, pero la hoja dice ` +
            `"${s.rotulo}". Revisa de qué año es el fichero antes de fiarte de las fechas.`);
        }
      }
    }

    // --- Columnas de origen, producto y franja
    let colOrigen = null, colProducto = null, colFranja = null;
    for (let r = rango.s.r; r <= rango.e.r; r++) {
      for (let c = rango.s.c; c <= rango.e.c; c++) {
        const t = texto(r, c);
        if (colOrigen == null && BANNERS.rotulos.origen.test(t)) colOrigen = c;
        if (colProducto == null && BANNERS.rotulos.producto.test(t)) colProducto = c;
        if (colFranja == null && BANNERS.franjaPatron.test(t)) colFranja = c;
      }
    }
    if (colFranja == null) {
      avisar('cabecera', 1, 'No encuentro la columna de franja (L-X / J-D). Sin ella no sé qué día publica cada banner');
      return { tasks: [], warnings: avisos, meta: { hoja: nombreHoja, verdes: 0 } };
    }
    for (const [nombre, col] of [['origen cliente', colOrigen], ['objetivo/producto', colProducto]]) {
      if (col == null) avisar('cabecera', 1, `No encuentro la columna de ${nombre}; las tareas saldrán sin ese dato`);
    }

    const festivos = new Set(BANNERS.festivos || []);
    const tasks = [];
    let verdes = 0, blancas = 0;
    let posicion = '';       // cabecera de posición vigente
    let bloque = null;       // bloque de filas vigente

    for (let r = rango.s.r; r <= rango.e.r; r++) {
      const primera = texto(r, rango.s.c);

      // ¿Empieza aquí una posición nueva?
      const mp = primera.match(BANNERS.posicionPatron);
      if (mp) { posicion = `Posición ${mp[1]}`; bloque = null; continue; }
      if (BANNERS.dispositivosPatron.test(primera)) {
        // 'DISPOSITIVOS' a secas no dice si es la 4 o la 6. Lo dice el
        // 'Menutelef 4A' / 'menutelef6' de las columnas de al lado.
        const pista = [texto(r, colOrigen ?? rango.s.c), texto(r, colProducto ?? rango.s.c)]
          .map(t => t.match(BANNERS.menutelefPatron)).find(Boolean);
        posicion = pista ? `Posición dispositivos ${pista[1]}` : 'Posición dispositivos';
        if (!pista) {
          avisar('posicion', r + 1,
            'Bloque "DISPOSITIVOS" sin "Menutelef": no sé si es la posición 4 o la 6');
        }
      }

      // ¿Empieza aquí un bloque de banner? Lo marca el código de la
      // primera columna, o el propio 'DISPOSITIVOS'.
      if (primera) {
        bloque = {
          fila: r,
          codigo: BANNERS.dispositivosPatron.test(primera)
            ? (posicion.match(/(\d+)\s*$/) ? 'DISPO' + posicion.match(/(\d+)\s*$/)[1] : 'DISPO')
            : primera,
          origen:   colOrigen   != null ? texto(r, colOrigen)   : '',
          producto: colProducto != null ? texto(r, colProducto) : '',
          posicion
        };
      }

      const franjaTexto = texto(r, colFranja).toUpperCase().replace(/\s+/g, '');
      const franja = BANNERS.franjas[franjaTexto];
      if (!franja || !bloque) continue;   // fila de separación o de cabecera

      for (const s of semanas) {
        const ref = XLSX.utils.encode_cell({ r, c: s.col });
        // Una celda combinada se lee una sola vez, en su esquina.
        if ((raices.get(ref) || ref) !== ref) continue;

        const celda = ws[ref];
        const contenido = limpio(celda?.v);
        const color = colorDe(celda, tema);
        const fam = familia(color);

        if (BANNERS.ignorar.test(contenido)) continue;   // CORPO: no es nuestra
        if (fam === 'blanco' || fam === 'gris') { if (contenido) blancas++; continue; }
        if (!contenido) continue;                        // pintada pero vacía: no hay nada que pedir

        if (fam !== 'verde') {
          // Ni verde ni blanca ni CORPO, y con texto dentro. No me la
          // invento: la digo, y que la mire alguien.
          const comoEsta = color ? `está en ${hex(color)}, que no es verde ni blanco` : 'no está pintada';
          avisar('color', r + 1,
            `${ref} ${comoEsta}, y tiene texto: "${contenido.slice(0, 40)}". No la he ` +
            `convertido en tarea. Si es una creatividad nueva, píntala de verde y vuelve a subir el fichero.`);
          continue;
        }

        verdes++;

        // Fechas: publica y entrega
        let publica = '', entrega = '';
        if (anio) {
          const d = lunesDe(anio, s.num);
          d.setDate(d.getDate() + franja.dia);
          publica = iso(d);
          entrega = iso(restarLaborables(d, BANNERS.entregaLaborables, festivos));
        }

        const creatividad = contenido.replace(/\s*\n\s*/g, ' · ');
        const cuando = `${s.rotulo || 'S' + s.num}`;
        const nombre = `BANNER ${bloque.codigo} S${s.num} ${franjaTexto} · ${creatividad}`;

        // Producto: manda lo que dice la creatividad, que es de lo que va
        // el banner. La columna del bloque suele traer cuatro productos
        // juntos y no decide nada.
        const casa = BANNERS.productoPorTexto.find(x => x.pattern.test(creatividad))
                  || BANNERS.productoPorTexto.find(x => x.pattern.test(bloque.producto));
        if (!casa) {
          avisar('producto', r + 1,
            `${ref}: no sé qué producto es "${creatividad.slice(0, 40)}". Va a OTROS; ` +
            `si se repite, se añade a la tabla de banners.`);
        }
        const product = casa?.product;
        const sectionId = casa?.section
          || CATALOGS.productSectionMap[product || 'Otros']
          || 'otros';

        tasks.push({
          id: `BAN-${ref}`,
          pac: '',
          tsk: '',
          name: nombre,
          product: product || 'Otros',
          sectionId,
          format: BANNERS.formato,
          dueDate: entrega,
          typology: 'Growth',
          clientType: '',
          palanca: '',                  // el fichero de banners no trae palanca
          estado: CATALOGS.estadoInicial,
          description: '',
          banner: {
            celda: ref,
            posicion: bloque.posicion,
            codigo: bloque.codigo,
            origen: bloque.origen,
            productoHoja: bloque.producto,
            semana: `S${s.num}`,
            vigencia: cuando,
            franja: franjaTexto,
            franjaTexto: franja.texto,
            creatividad,
            publica,
            color: hex(color)
          },
          excel: {
            fila: r + 1,
            medio: BANNERS.formato,
            palanca: '',
            producto: bloque.producto,
            viabilidad: '',
            subpalanca: '',
            objetivo: creatividad,
            nombreTarea: '',
            responsable: '',
            po: '',
            mes: '',
            semana: `S${s.num}`
          }
        });
      }
    }

    // Dos celdas verdes pueden dar la misma tarea: en octubre pasa, porque
    // hay bloques repetidos en la hoja. No se juntan ni se tiran —eso es
    // una decisión de Comercialización, no del lector— pero se dicen.
    const porNombre = new Map();
    for (const t of tasks) {
      if (!porNombre.has(t.name)) porNombre.set(t.name, []);
      porNombre.get(t.name).push(t.banner.celda);
    }
    for (const [nombre, celdas] of porNombre) {
      if (celdas.length > 1) {
        avisar('repetida', 0,
          `${celdas.join(' y ')} dan la misma tarea (${nombre.slice(0, 50)}…). ` +
          `Están las ${celdas.length}: si sobra alguna, quítala en la revisión.`);
      }
    }

    return {
      tasks,
      warnings: avisos,
      meta: {
        hoja: nombreHoja,
        anio,
        filas: tasks.length,
        verdes,
        reutilizadas: blancas,
        semanas: semanas.map(s => `S${s.num}`),
        posiciones: [...new Set(tasks.map(t => t.banner.posicion))]
      }
    };
  }

  return { parse };
})();
