#!/usr/bin/env node
/* ============================================================
   Campaign Loader · Pruebas
   ------------------------------------------------------------
   Se ejecutan con `npm test`, en dos segundos y sin gastar nada:
   ni una llamada al modelo, ni una a Asana.

   Qué se prueba y por qué así:

   · LOS LECTORES, contra los ficheros reales de octubre. No hay
     ficheros de mentira: un Excel inventado prueba que el código
     hace lo que yo creo, no que aguante lo que Comercialización
     manda de verdad. Los números que se comprueban son los que
     cerramos con Bárbara y Eduardo: 42 banners, las fechas con
     el festivo del 12, los correos verificados contra Asana.

   · LAS TABLAS DE data.js, siempre. Son lo que más se toca y lo
     que rompe más callado: un producto mal escrito no da error,
     manda la campaña a la sección equivocada y nadie se entera.

   Los ficheros reales llevan PACs y no están en el repositorio
   (`worker/fixtures/` está en .gitignore). Si no están, esas
   pruebas se saltan y se dice; las de las tablas corren igual.
============================================================ */

const fs = require('fs');
const path = require('path');

const PUBLICO = path.join(__dirname, 'public');
const FIXTURES = path.join(__dirname, 'fixtures');

/* ---------------- el mínimo para correr el navegador aquí ---------------- */
const XLSX = require(path.join(PUBLICO, 'vendor', 'xlsx.full.min.js'));
const fuente = f => fs.readFileSync(path.join(PUBLICO, f), 'utf8');
const APP = new Function('XLSX',
  fuente('data.js') + fuente('excel.js') + fuente('banners.js') +
  '; return { CATALOGS, EXCEL, BANNERS, EXCEL_PARSER, BANNERS_PARSER };')(XLSX);

const leer = nombre => {
  const ruta = path.join(FIXTURES, nombre);
  if (!fs.existsSync(ruta)) return null;
  return new Uint8Array(fs.readFileSync(ruta)).buffer;
};

/* ---------------- marcador ---------------- */
let bien = 0, mal = 0, saltadas = 0;
const fallos = [];

function prueba(nombre, fn) {
  try {
    const r = fn();
    if (r === 'saltada') { saltadas++; console.log(`  –  ${nombre} (sin el fichero real)`); return; }
    bien++; console.log(`  ✓  ${nombre}`);
  } catch (e) {
    mal++; fallos.push({ nombre, mensaje: e.message });
    console.log(`  ✗  ${nombre}`);
    console.log(`       ${e.message}`);
  }
}

function igual(obtenido, esperado, que) {
  const a = JSON.stringify(obtenido), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${que}: esperaba ${b} y es ${a}`);
}
const grupo = n => console.log(`\n${n}`);

/* ============================================================
   1 · LAS TABLAS DE data.js
   Corren siempre: no necesitan ficheros.
============================================================ */
grupo('Tablas de configuración');

prueba('todos los productos del Excel apuntan a un producto que existe en Asana', () => {
  const reales = Object.keys(APP.CATALOGS.fields.producto.options);
  const malos = Object.entries(APP.EXCEL.productoProduct)
    .filter(([, p]) => !reales.includes(p)).map(([k, p]) => `${k} → ${p}`);
  igual(malos, [], 'productos inventados');
});

prueba('todos los productos del Excel caen en una sección que existe', () => {
  const secciones = APP.CATALOGS.sections.map(s => s.id);
  const malas = [...new Set(Object.values(APP.EXCEL.productoProduct))]
    .map(p => APP.CATALOGS.productSectionMap[p])
    .filter(s => s && !secciones.includes(s));
  igual(malas, [], 'secciones inventadas');
});

prueba('la tabla de productos de banners apunta a productos y secciones reales', () => {
  const reales = Object.keys(APP.CATALOGS.fields.producto.options);
  const secciones = APP.CATALOGS.sections.map(s => s.id);
  const malos = APP.BANNERS.productoPorTexto
    .filter(x => !reales.includes(x.product) || (x.section && !secciones.includes(x.section)))
    .map(x => x.product + (x.section ? ' / ' + x.section : ''));
  igual(malos, [], 'productos o secciones de banners inventados');
});

prueba('el formato de los banners existe en Asana', () => {
  const formatos = Object.keys(APP.CATALOGS.fields.formato.options);
  if (!formatos.includes(APP.BANNERS.formato)) {
    throw new Error(`"${APP.BANNERS.formato}" no está entre ${formatos.join(', ')}`);
  }
});

prueba('las cuatro palancas de Comercialización se pueden elegir en la revisión', () => {
  const cerradas = ['Captación No Cliente', 'Desarrollo', 'Fidelización/Dinamización', 'Prevención'];
  const faltan = cerradas.filter(p => !APP.CATALOGS.palancaOptions.includes(p));
  igual(faltan, [], 'palancas que no salen');
});

prueba('toda palanca elegible sabe qué tipología es', () => {
  const sinTipologia = APP.CATALOGS.palancaOptions.filter(p => !APP.EXCEL.palancaTypology[p]);
  igual(sinTipologia, [], 'palancas sin tipología');
});

prueba('el orden de secciones no nombra secciones que no existen', () => {
  const secciones = APP.CATALOGS.sections.map(s => s.id);
  const fantasmas = APP.CATALOGS.ordenSecciones.filter(id => !secciones.includes(id));
  igual(fantasmas, [], 'secciones fantasma en el orden');
});

prueba('toda sección de Asana tiene un sitio en el orden', () => {
  const olvidadas = APP.CATALOGS.sections
    .map(s => s.id).filter(id => !APP.CATALOGS.ordenSecciones.includes(id));
  igual(olvidadas, [], 'secciones sin sitio (irían al final sin querer)');
});

/* ============================================================
   2 · EL CORREO DEL PETICIONARIO
   Los diez interlocutores de Comercialización, confirmados por
   Carlos el 1-oct-2026. Si esto se rompe, se está escribiendo el
   peticionario equivocado en todas las tareas.

   Ojo con MARIA CARLA SANZ ESTEBAN: firma `carla.sanzesteban` y
   no `mariacarla.sanzesteban`. Es la razón de que aquí haya una
   lista y no una regla.
============================================================ */
grupo('Peticionario: del nombre del Excel al correo corporativo');

const CORREOS = {
  'ANA MARIA ARIZPELETA IRIARTE': 'anamaria.arizpeletairiarte@telefonica.com',
  'INES MOLINERO MARTIN':         'ines.molineromartin@telefonica.com',
  'MARIA BLANCA CABEZON NORES':   'mariablanca.cabezonnores@telefonica.com',
  'MARIA CARLA SANZ ESTEBAN':     'carla.sanzesteban@telefonica.com',
  'MARTA MARIN DE LAS HERAS':     'marta.marindelasheras@telefonica.com',
  'MONTSERRAT BRUÑA IGLESIAS':    'montserrat.brunaiglesias@telefonica.com',
  'SARA SÁNCHEZ RUBIO':           'sara.sanchezrubio@telefonica.com',
  'SONIA VILLAR PASCUAL':         'sonia.villarpascual@telefonica.com',
  'SUSANA APARICIO GRACIA':       'susana.apariciogracia@telefonica.com',
  'YOLANDA MORENO PIMENTEL':      'yolanda.morenopimentel@telefonica.com'
};

for (const [nombre, correo] of Object.entries(CORREOS)) {
  prueba(`${nombre} → ${correo}`, () => {
    igual(APP.EXCEL_PARSER.correo(nombre).correo, correo, 'correo');
  });
}

prueba('quien no está en la lista no se inventa: vacío y avisando con su nombre', () => {
  const r = APP.EXCEL_PARSER.correo('LAURA GOMEZ PEREZ');
  igual(r.correo, '', 'correo de alguien desconocido');
  if (!r.aviso) throw new Error('se lo ha callado');
  if (!/LAURA GOMEZ PEREZ/.test(r.aviso)) throw new Error('el aviso no dice de quién habla');
});

prueba('el nombre se reconoce venga como venga del Excel', () => {
  // En el Excel van en mayúsculas y sin acentos; la lista los tiene con
  // ellos. Da igual cómo llegue: es la misma persona.
  const esperado = 'montserrat.brunaiglesias@telefonica.com';
  for (const forma of ['MONTSERRAT BRUÑA IGLESIAS', 'Montserrat Bruña Iglesias',
                       'MONTSERRAT BRUNA IGLESIAS', '  MONTSERRAT   BRUÑA  IGLESIAS ']) {
    igual(APP.EXCEL_PARSER.correo(forma).correo, esperado, `correo de "${forma}"`);
  }
});

prueba('sin responsable no se inventa un correo', () => {
  igual(APP.EXCEL_PARSER.correo('').correo, '', 'correo de un nombre vacío');
});

/* ============================================================
   3 · EL LECTOR DE BANNERS, contra la parrilla real de octubre
============================================================ */
grupo('Banners: la parrilla real de octubre');

const buferBanners = leer('banners-oct-2026.xlsx');
const banners = buferBanners
  ? APP.BANNERS_PARSER.parse(buferBanners, 'Planificación Banners MPlus Oct 26.xlsx')
  : null;
const conBanners = fn => () => banners ? fn() : 'saltada';

prueba('salen las 42 tareas que contamos con Bárbara y Eduardo', conBanners(() => {
  igual(banners.tasks.length, 42, 'número de banners');
}));

prueba('las cuatro posiciones, ni una más ni una menos', conBanners(() => {
  igual(banners.meta.posiciones.sort(),
    ['Posición 4', 'Posición 6', 'Posición dispositivos 4', 'Posición dispositivos 6'],
    'posiciones');
}));

prueba('ninguna celda CORPO se convierte en tarea', conBanners(() => {
  const coladas = banners.tasks.filter(t => /CORPO/i.test(t.banner.creatividad));
  igual(coladas.map(t => t.banner.celda), [], 'CORPO colados');
}));

prueba('la entrega salta el festivo del 12 de octubre', conBanners(() => {
  // M4 publica el jueves 15. Tres laborables atrás serían 14, 13 y 12,
  // pero el 12 es fiesta nacional: la entrega se va al viernes 9.
  const t = banners.tasks.find(x => x.banner.celda === 'M4');
  if (!t) throw new Error('no encuentro el banner de la celda M4');
  igual([t.banner.publica, t.dueDate], ['2026-10-15', '2026-10-09'], 'publica y entrega');
}));

prueba('una semana sin festivos entrega tres laborables antes', conBanners(() => {
  // K3 publica el lunes 5. Atrás: viernes 2, jueves 1, miércoles 30.
  const t = banners.tasks.find(x => x.banner.celda === 'K3');
  igual([t.banner.publica, t.dueDate], ['2026-10-05', '2026-09-30'], 'publica y entrega');
}));

prueba('toda tarea de banner lleva fecha', conBanners(() => {
  igual(banners.tasks.filter(t => !t.dueDate).map(t => t.banner.celda), [], 'banners sin fecha');
}));

prueba('cada banner tiene un identificador propio', conBanners(() => {
  igual(new Set(banners.tasks.map(t => t.id)).size, banners.tasks.length, 'identificadores únicos');
}));

prueba('una celda escrita que no es ni verde ni blanca se avisa', conBanners(() => {
  // I12 trae "DEPORTES EUROLIGA" y no está pintada. No es tarea, pero
  // tampoco se tira en silencio.
  const avisos = banners.warnings.filter(w => w.tipo === 'color');
  if (!avisos.some(w => /I12/.test(w.msg))) {
    throw new Error('I12 ya no se avisa: o se ha pintado, o hemos dejado de mirar');
  }
}));

prueba('dos celdas que dan la misma tarea se avisan', conBanners(() => {
  const repes = banners.warnings.filter(w => w.tipo === 'repetida');
  if (repes.length < 2) throw new Error(`esperaba al menos 2 avisos de repetida y hay ${repes.length}`);
}));

prueba('todos los banners van al formato de banners', conBanners(() => {
  const otros = [...new Set(banners.tasks.map(t => t.format))].filter(f => f !== APP.BANNERS.formato);
  igual(otros, [], 'formatos que no tocan');
}));

/* ============================================================
   4 · EL LECTOR DEL EXCEL, contra el fichero real de octubre
============================================================ */
grupo('Campañas: el Excel real de octubre');

const buferExcel = leer('eduardo-v2.xlsx');
const campanas = buferExcel ? APP.EXCEL_PARSER.parse(buferExcel) : null;
const conExcel = fn => () => campanas ? fn() : 'saltada';

prueba('se leen las 69 campañas del fichero', conExcel(() => {
  igual(campanas.meta.filas, 69, 'campañas leídas');
}));

prueba('ningún producto del mes se queda fuera de nuestra tabla', conExcel(() => {
  // Un valor que el Excel trae y nosotros no conocemos es cosa nuestra:
  // se añade a data.js. Esto tiene que estar siempre a cero.
  const desconocidos = campanas.warnings
    .filter(w => w.tipo === 'producto' && /sin mapear/.test(w.msg)).map(w => w.msg);
  igual(desconocidos, [], 'productos que el Excel trae y la tabla no conoce');
}));

prueba('las campañas sin producto en el Excel se nombran una a una', conExcel(() => {
  // Esto NO tiene que estar a cero: en octubre hay dos campañas con la
  // celda vacía, y es un hueco del fichero que arregla Comercialización.
  // Lo que se prueba es que se dice de cuáles se trata, con su PAC, en
  // vez de un aviso mudo que nadie sabe a qué fila corresponde.
  const vacios = campanas.warnings.filter(w => w.tipo === 'producto' && /no trae producto/.test(w.msg));
  const mudos = vacios.filter(w => !/PAC\d+/.test(w.msg));
  igual(mudos.map(w => w.msg), [], 'avisos que no dicen de qué campaña hablan');
}));

prueba('ningún medio del mes se queda sin reconocer', conExcel(() => {
  const sinMedio = campanas.warnings.filter(w => w.tipo === 'medio' && /sin reconocer/.test(w.msg));
  igual(sinMedio.map(w => w.msg), [], 'medios sin reconocer');
}));

prueba('ninguna palanca del mes se queda sin mapear', conExcel(() => {
  const sinPalanca = campanas.warnings.filter(w => w.tipo === 'palanca').map(w => w.msg);
  igual(sinPalanca, [], 'palancas sin mapear');
}));

prueba('toda campaña sale con fecha', conExcel(() => {
  igual(campanas.tasks.filter(t => !t.dueDate).map(t => t.pac), [], 'campañas sin fecha');
}));

prueba('quien firma campañas y no está en la lista se dice por su nombre', conExcel(() => {
  // En octubre falta ARANCHA ORTIZ TORRES, que firma PAC37421 y no está
  // en la lista de interlocutores. No se le inventa el correo: la tarea
  // sale sin peticionario y el aviso la nombra. El día que Carlos
  // confirme su correo, se añade a data.js y esta prueba se queda sin
  // nada que contar, que es el final bueno.
  const fuera = [...new Set(campanas.tasks
    .filter(t => t.excel.responsable && !t.excel.peticionario)
    .map(t => t.excel.responsable))];
  const mudos = fuera.filter(n =>
    !campanas.warnings.some(w => w.tipo === 'peticionario' && w.msg.includes(n)));
  igual(mudos, [], 'responsables que faltan y encima no se avisan');
}));

prueba('todos los correos salen de la lista, ninguno inventado', conExcel(() => {
  const conocidos = Object.values(APP.CATALOGS.correosConocidos);
  const raros = [...new Set(campanas.tasks.map(t => t.excel.peticionario).filter(Boolean))]
    .filter(c => !conocidos.includes(c));
  igual(raros, [], 'correos que no están en la lista');
}));

prueba('ninguna campaña cae en una sección que no existe', conExcel(() => {
  const secciones = APP.CATALOGS.sections.map(s => s.id);
  const perdidas = campanas.tasks.filter(t => !secciones.includes(t.sectionId)).map(t => t.pac);
  igual(perdidas, [], 'campañas en secciones fantasma');
}));

prueba('un PAC, una tarea', conExcel(() => {
  const pacs = campanas.tasks.map(t => t.pac).filter(Boolean);
  igual(new Set(pacs).size, pacs.length, 'PACs únicos');
}));

/* ---------------- resultado ---------------- */
console.log('\n' + '─'.repeat(56));
console.log(`${bien} bien · ${mal} mal${saltadas ? ` · ${saltadas} saltadas` : ''}`);
if (saltadas) {
  console.log('\nLas saltadas necesitan los Excel reales en worker/fixtures/.');
  console.log('No están en el repositorio a propósito: llevan PACs.');
}
if (mal) {
  console.log('\nLo que falla:');
  fallos.forEach(f => console.log(`  · ${f.nombre}\n      ${f.mensaje}`));
}
process.exit(mal ? 1 : 0);
