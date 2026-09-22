/* ============================================================
   Campaign Loader · Catálogos y datos
   ------------------------------------------------------------
   COSTURA DE CABLEADO:
   Todo lo que hay aquí es sustituible por respuestas reales.
   - CATALOGS  → vendrá de Asana (custom fields del proyecto)
   - MOCK_TASKS → vendrá de interpretarDocumentos() (API Claude)
   El resto de la app NO debe importar nada más de este fichero.
============================================================ */

const CATALOGS = {
  sections: [
    { id: 'conectividad', name: 'Conectividad' },
    { id: 'convergente',  name: 'MiMovistar Convergente' },
    { id: 'dispositivos', name: 'Dispositivos' },
    { id: 'plus',         name: 'Movistar Plus+' },
    { id: 'futbol',       name: 'Fútbol' },
    { id: 'nuevos',       name: 'Nuevos Negocios' },
    { id: 'otros',        name: 'Otros' }
  ],

  productOptions: [
    'MiMovistar', 'Fibra Adicional', 'Dispositivos', 'Movistar Plus+',
    'Fútbol', 'M+ Ficción', 'Prepago', 'Gaming', 'Nuevos Negocios', 'Marca', 'Otros'
  ],

  // Producto → Sección. Determinista. Punto único de configuración.
  productSectionMap: {
    'MiMovistar': 'convergente',
    'Fibra Adicional': 'conectividad',
    'Prepago': 'conectividad',
    'Dispositivos': 'dispositivos',
    'Movistar Plus+': 'plus',
    'M+ Ficción': 'plus',
    'Fútbol': 'futbol',
    'Gaming': 'nuevos',
    'Nuevos Negocios': 'nuevos',
    'Marca': 'marca',
    'Otros': 'otros'
  },

  formatOptions: [
    'Email y/o SMS', 'RCS', 'Banners TV',
    'Enews contenidos TV', 'Mailing/offline', 'Customer Journey'
  ],

  clientTypeOptions: ['Convergente', 'Solo Móvil', 'Solo BAF', 'No Cliente'],

  typologyOptions: ['Growth', 'Value', 'Servicing'],

  // Estado inicial de las tareas al crearse en Asana.
  // Configurable: cuando se acuerde el set de estados con Comercialización,
  // se cambia AQUÍ y en ningún otro sitio.
  estadoInicial: 'Pdte Comercialización',

  asanaProject: 'BTL · Planificación Julio 2026 (TEST)'
};

/* ------------------------------------------------------------
   EXCEL DE COMERCIALIZACIÓN → ASANA
   Sacado del primer fichero real (ASANA FICHERO CARGA.xlsx,
   sep-oct 2026, guardado en ../fixtures/). Ver DECISIONES.md
   → "Lo que sabemos del Excel real".

   1 fila = 1 tarea. Los valores son los que aparecen en el
   fichero; si un mes sale uno nuevo, se añade aquí.
------------------------------------------------------------ */
const EXCEL = {
  // Hoja y cabeceras (fila 1). Solo se usan A–P; Q–AF vienen vacías.
  sheet: 'ASANA',
  columns: {
    fechaGrabacion: 'FECHA GRABACION EN FICHERO ASANA',   // A · texto '21/9/26'
    pac:            'CÓDIGO \nCAMPAÑA',                    // B · fórmula =MID(E;1;8). Validar contra E.
    tsk:            'CÓDIGO \nTAREA',                      // C · 'TSKnnnnn' o 'TSKPDTE' (pendiente)
    medio:          'MEDIO',                                // D
    nombre:         'NOMBRE DESCRIPTIVO DE LA  CAMPAÑA ',   // E · nombre de la tarea (ya lleva el PAC delante)
    mes:            'MES',                                  // F · entero
    semana:         'SEMANA ENVIO',                         // G · entero
    fechaInicio:    'FECHA INICIO SOLICITADA ',             // H · texto '21-sep.-2026'
    viabilidad:     'VIABILIDAD',                           // I · Aprobada | Planificada
    nombreTarea:    '\u00a0NOMBRE DE LA TAREA Ó DESCRIPCIÓN DE LA TAREA\u00a0', // J · a veces 0 o vacío
    po:             'PO ESTIMADO',                          // K · unidad sin confirmar. Llevar como texto.
    palanca:        'PALANCA',                              // L
    subpalanca:     'SUBPALANCA',                           // M
    producto:       'PRODUCTO / KPI',                       // N
    objetivo:       'OBJETIVO / DESCRIPCIÓN CAMPAÑA',       // O
    responsable:    'RESPONSABLE.'                          // P
  },

  // Regex del PAC. Se aplica sobre E (nombre), no sobre B.
  pacPattern: /^PAC\d{5}/,

  // Palancas que NO se importan por ahora. Legal es Servicing y va por
  // otro circuito. Se cuentan y se avisa, pero no generan tarea.
  palancasOmitidas: ['Legal'],

  // PALANCA → Tipología. Regla acordada internamente, pendiente de
  // confirmar con Comercialización.
  palancaTypology: {
    'Desarrollo':                'Growth',
    'Captación No Cliente':      'Growth',
    'Fidelización/Dinamización': 'Value',
    'Legal':                     'Servicing'
  },

  // VIABILIDAD → estado de la tarea. Pendiente de acordar el set.
  viabilidadEstado: {
    'Aprobada':    'Aprobada',
    'Planificada': 'Pdte Comercialización'
  },

  // MEDIO (Excel) → Formato (Asana). Normalizar espacios antes de buscar.
  // 'Enews contenidos' no se detecta por MEDIO sino por PRODUCTO (ver abajo).
  medioFormat: {
    'E-Mailing':       'Email y/o SMS',
    'SMS':             'Email y/o SMS',
    'RCS':             'RCS',
    'Carta Oficial':   'Mailing/offline',
    'CARTA SAT':       'Mailing/offline',
    'App Mi Movistar': 'Customer Journey'   // sin opción propia en Asana; provisional
  },

  // PRODUCTO / KPI (Excel) → Producto (Asana). La sección sale luego
  // de productSectionMap. 'Legal', 'Marca', 'Info' y 'Horecas /LLPP'
  // no son productos: van a Otros.
  productoProduct: {
    'Fibra Adicional':           'Fibra Adicional',
    'FTTR':                      'Fibra Adicional',
    'Alta BAF':                  'Fibra Adicional',
    'R2R':                       'Dispositivos',
    'Fútbol+':                   'Fútbol',
    'Deportes Total':            'Movistar Plus+',
    'Ficción Total':             'M+ Ficción',
    'Movistar Plus+ (Paquete)':  'Movistar Plus+',
    'Atresplayer':               'Movistar Plus+',
    'Enews contenidos':          'Movistar Plus+',
    'Helios':                    'Nuevos Negocios',
    'Renting coche eléctrico':   'Nuevos Negocios',
    'eSIMFlag':                  'Nuevos Negocios',
    'Movistar Prosegur Alarmas': 'Nuevos Negocios',
    'Legal':                     'Otros',        // no se importa (palancasOmitidas)
    'Marca':                     'Marca',        // ENEWS semanal, sección propia
    'Info':                      'Otros',        // se afina con productoPorNombre
    'Horecas /LLPP':             'Movistar Plus+' // es segmento, no producto; ver productoSubpalancaOverride
  },

  // "Info" es cajón de sastre: el producto se reconoce por el nombre.
  // Primer patrón que casa, gana. Si ninguno casa, queda en Otros.
  productoPorNombre: [
    { pattern: /RED_SEGURA|RED SEGURA/i,        product: 'MiMovistar' },
    { pattern: /SORTEO|CAMISETA|MUNDIAL/i,      product: 'Fútbol' },
    { pattern: /APP_MIMOVISTAR.*CONTENIDOS/i,   product: 'Movistar Plus+' }
  ],

  // PRODUCTO del Excel → título del brief en el documento de estrategia.
  // Tabla explícita a propósito: vincular por parecido es justo lo que
  // DECISIONES.md prohíbe (umbral alto, mejor no encontrar que encontrar
  // mal). Un producto sin entrada aquí sale sin contexto, que es normal.
  productoBrief: {
    'Fútbol+':                   'Desarrollo y winback clientes sin Futbol',
    'Horecas /LLPP':             'Captación y desarrollo fútbol (Horecas)',
    'Deportes Total':            'Estrategia desarrollo Deportes, Motor y Baloncesto',
    'Ficción Total':             'Estrategia desarrollo Ficción',
    'Fibra Adicional':           'Estrategia Fibra Adicional',
    'FTTR':                      'Estrategia FTTR',
    // Dos briefs hablan de captación BAF y el Excel no desambigua:
    // se vincula al primero pero la tarea sale en amarillo.
    'Alta BAF':                  ['Estrategia GN BAF SA',
                                  'Captación nuevos clientes BAF con fútbol'],
    'eSIMFlag':                  'eSimFLAG',
    'Renting coche eléctrico':   'Movistar Renting Coches',
    'Helios':                    'Helios',
    'Movistar Prosegur Alarmas': 'MPA'
  },

  // Horecas es a quién, no qué. Por SUBPALANCA se sabe el producto real.
  productoSubpalancaOverride: {
    'Horecas /LLPP': { 'Plataforma TV': 'Fútbol', 'Dinamización de TV': 'Movistar Plus+' }
  },

  // Productos que fuerzan el formato aunque MEDIO diga E-Mailing.
  productoFormatOverride: {
    'Enews contenidos': 'Enews contenidos TV'
  }
};

/* ------------------------------------------------------------
   DATOS DE EJEMPLO
   Sustituir por la respuesta de interpretarDocumentos().
   Estructura de cada tarea = contrato con el backend.
------------------------------------------------------------ */
const MOCK_FILES = {
  excel:    { name: 'PAC_Julio2026_planificacion.xlsx', ext: 'XLSX' },
  strategy: { name: 'Estrategia_Comercial_Julio_v3.pdf', ext: 'PDF' }
};

/* ------------------------------------------------------------
   linkConfidence: 'high' | 'low' | (ausente = sin contexto vinculado)
   Mide la VINCULACIÓN con el PDF, no la fiabilidad del dato del
   Excel (que es fiable por definición — ver DECISIONES.md).
   - 'high'   → contexto encontrado, vinculación inequívoca
   - 'low'    → hay contexto pero la vinculación es dudosa (linkNote)
   - ausente  → sin contexto. Es el caso normal, no un problema.
   description = el contexto de mensaje en sí (claim/argumento/tono),
   nunca datos que ya vengan del Excel (fecha, canal, segmento...).
------------------------------------------------------------ */
const MOCK_TASKS = [
  { id:'t1', sectionId:'conectividad', name:'PAC00010_eSimFLAG_Resto clientes_Julio',
    product:'Prepago', format:'Email y/o SMS', dueDate:'2026-07-08', clientType:'Solo Móvil',
    typology:'Growth', linkConfidence:'high', contextSource:'Estrategia eSIM Flag — Activación',
    description:'Claim: "actívala en 2 minutos, sin líos". Tono práctico y directo; evitar cualquier mención a permanencia.' },

  { id:'t2', sectionId:'conectividad', name:'PAC00107_Fibra1Gb_Upselling BAF_Julio',
    product:'Fibra Adicional', format:'Email y/o SMS', dueDate:'2026-07-15', clientType:'Solo BAF',
    typology:'Growth', linkConfidence:'high', contextSource:'Estrategia Fibra Adicional — Primera quincena (slide 33)',
    description:'"Por ser cliente miMovistar, tienes fibra en tu segunda residencia por 15€/mes." La mejor conectividad al mejor precio: somos los más competitivos del mercado en segunda fibra.' },

  { id:'t2b', sectionId:'conectividad', name:'PAC00108_Fibra1Gb_Upselling Hijos Estudiantes_Julio',
    product:'Fibra Adicional', format:'Email y/o SMS', dueDate:'2026-07-25', clientType:'Convergente',
    typology:'Growth', linkConfidence:'high', contextSource:'Estrategia Fibra Adicional — Segunda quincena (slide 34)',
    description:'"Vuelven a la Uni." Por ser cliente miMovistar, tienes una fibra para quien más quieres por 15€/mes. Mismo producto que la primera quincena, pero el foco pasa de segunda residencia a hijos estudiantes.' },

  { id:'t3', sectionId:'conectividad', name:'PAC00105_Cobertura5G_NoClientes_Julio',
    product:'Prepago', format:'RCS', dueDate:'2026-07-22', clientType:'No Cliente',
    typology:'Growth', linkConfidence:'low', contextSource:'Estrategia Ampliación Cobertura 5G',
    linkNote:'El documento habla de "cobertura que llega donde antes no llegaba" en dos bloques distintos (zona rural / zona urbana) sin fecha que distinga cuál aplica aquí.',
    description:'Posible vinculación con el bloque de cobertura 5G, pero no queda claro si el enfoque es rural o urbano.' },

  { id:'t4', sectionId:'convergente', name:'PAC00101_MiMovistarMax_Migración legacy_Julio',
    product:'MiMovistar', format:'Customer Journey', dueDate:'2026-07-10', clientType:'Convergente',
    typology:'Value', linkConfidence:'high', contextSource:'Estrategia Migración Legacy → MiMovistar Max',
    description:'"El mismo precio, ahora con más." La estrategia insiste en dejar claro que no cambia el precio durante el primer año.' },

  { id:'t5', sectionId:'convergente', name:'PAC00110_ConvergenteTV_CrossSell_Julio',
    product:'MiMovistar', format:'Email y/o SMS', dueDate:'2026-07-17', clientType:'Convergente',
    typology:'Growth', description:'' },

  { id:'t6', sectionId:'dispositivos', name:'PAC00104_SamsungS26_Renove_Julio',
    product:'Dispositivos', format:'Email y/o SMS', dueDate:'2026-07-11', clientType:'Convergente',
    typology:'Growth', linkConfidence:'high', contextSource:'Estrategia Renove Dispositivos — Verano',
    description:'Claim: "cámbialo sin pagarlo todo de golpe". Foco en la financiación a plazos sin intereses.' },

  { id:'t7', sectionId:'dispositivos', name:'PAC00112_TabletVerano_Stock_Julio',
    product:'Dispositivos', format:'Mailing/offline', dueDate:'2026-07-24', clientType:'Convergente',
    typology:'Growth', description:'' },

  { id:'t8', sectionId:'plus', name:'PAC00106_MPlus_EstrenosJulio_Base TV_Julio',
    product:'Movistar Plus+', format:'Enews contenidos TV', dueDate:'2026-07-03', clientType:'Convergente',
    typology:'Value', linkConfidence:'high', contextSource:'Estrategia Contenidos Movistar Plus+ — Julio',
    description:'"Este mes no te pierdas nada": nueva temporada de La Mesías y los estrenos de cine destacados.' },

  { id:'t9', sectionId:'plus', name:'PAC00109_FicciónVerano_WinBack_Julio',
    product:'M+ Ficción', format:'Email y/o SMS', dueDate:'2026-07-18', clientType:'Solo Móvil',
    typology:'Value', linkConfidence:'low', contextSource:'Estrategia Recuperación de Bajas — Ficción',
    linkNote:'El documento menciona un win-back de M+ Ficción, pero no queda claro si corresponde a este envío o a una acción de retención más amplia sin fecha concreta.',
    description:'"Vuelve a M+ Ficción por 3,90€/mes los tres primeros meses" — oferta de retorno para bajas recientes.' },

  { id:'t10', sectionId:'futbol', name:'PAC00102_MFutbol_Pretemporada_Base móvil_Julio',
    product:'Fútbol', format:'Email y/o SMS', dueDate:'2026-07-20', clientType:'Solo Móvil',
    typology:'Growth', linkConfidence:'high', contextSource:'Estrategia Desarrollo y Winback Fútbol (Residencial)',
    description:'Campaña bajo el paraguas "Vuelve a soñar", que conecta con la ilusión del arranque de temporada. Argumento central: "contrata hoy y empieza a pagar cuando empieza el fútbol".' },

  { id:'t11', sectionId:'futbol', name:'PAC00103_MFutbol_Renovación LaLiga_Julio',
    product:'Fútbol', format:'Banners TV', dueDate:'2026-07-28', clientType:'Convergente',
    typology:'Value', description:'' },

  { id:'t12', sectionId:'nuevos', name:'PAC00111_GamingPass_Lanzamiento_Julio',
    product:'Gaming', format:'Customer Journey', dueDate:'2026-07-14', clientType:'Solo Móvil',
    typology:'Growth', description:'' },

  { id:'t13', sectionId:'otros', name:'PAC00113_EncuestaNPS_PostCampaña_Julio',
    product:'Otros', format:'Email y/o SMS', dueDate:'2026-07-30', clientType:'Convergente',
    typology:'Value', description:'' }
];
