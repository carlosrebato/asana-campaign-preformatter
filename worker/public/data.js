/* ============================================================
   Campaign Loader · Catálogos y datos
   ------------------------------------------------------------
   COSTURA DE CABLEADO:
   Todo lo que hay aquí es sustituible por respuestas reales.
   - CATALOGS  → vendrá de Asana (custom fields del proyecto)
   - MOCK_TASKS → vendrá de interpretarDocumentos() (API Claude)
   El resto de la app NO debe importar nada más de este fichero.
============================================================ */

/* ------------------------------------------------------------
   CATÁLOGOS DEL PROYECTO DE ASANA
   Secciones, campos y opciones con sus GIDs. NO se escriben a
   mano: los trae `API.cargarCatalogos()` leyendo el proyecto.
   Lo de aquí es solo una copia de seguridad, tomada de
   "BTL - Run ✉️" el 22-sep-2026, para que la app arranque sin
   backend. Si Asana responde, esto se sustituye entero.

   Lo que NO puede venir de Asana es el mapeo del Excel (abajo):
   que "Fútbol+" sea "M+ Futbol" es una decisión de negocio.
------------------------------------------------------------ */
const CATALOGS = {
  esCopia: true,   // pasa a false cuando los catálogos vienen de Asana

  sections: [
    { id: 'entradas',     gid: '1204962417752693', name: '➡️ENTRADAS' },
    { id: 'priorizadas',  gid: '1209498548935703', name: '🔴 Campañas priorizadas y Creatividades' },
    { id: 'conectividad', gid: '1204996811344449', name: '⚙️ Conectividad: FTTR, BAF, LME, Prepago' },
    { id: 'convergente',  gid: '1205311722361417', name: '📺📡📱 MIMOVISTAR (Convergente)' },
    { id: 'plus',         gid: '1204915090620356', name: '📺 Movistar Plus+' },
    { id: 'ficcion',      gid: '1204925632923532', name: '🎬 Ficción' },
    { id: 'marca',        gid: '1206534264732304', name: '💙ENEWS MARCA' },
    { id: 'dispositivos', gid: '1204934978113192', name: '📱 Dispositivos y Equipamiento' },
    { id: 'nuevos',       gid: '1205178855136200', name: '☀️ Nuevos Negocios' },
    { id: 'futbol',       gid: '1204998325343896', name: '⚽ Fútbol' },
    { id: 'deportes',     gid: '1204913685667285', name: '🏀🎾⛳  Deportes y Motor' },
    { id: 'enewsM',       gid: '1206938629839267', name: '📽️⚾  Enews Entretenimiento M+' },
    { id: 'beneficios',   gid: '1205016668838674', name: '💎BENEFICIOS Por ser MiMovistar' },
    { id: 'gaming',       gid: '1204913685667284', name: '🎮 Gaming' },
    { id: 'horecas',      gid: '1209325962167690', name: '🏨🍽️🍀HORECAS/LLPP' },
    { id: 'otros',        gid: '1206577638671869', name: '🤷‍♀️OTROS' }
  ],

  // Nombre del campo en Asana → cómo lo llama la app. El Worker
  // devuelve los campos por su nombre; aquí se traducen a las
  // claves que usa el código, para no repartir nombres por todo.
  fieldNames: {
    producto:     'Producto',
    formato:      'Formatos de comunicación',
    tipoCliente:  'Tipo de cliente',
    estado:       'Estado',
    peticionario: 'Peticionario'
  },

  fields: {
    producto: {
      gid: '1204870126999103', tipo: 'multi_enum',
      options: {
        'MiMovistar': '1204870126999104', 'Fibra Adicional': '1204870126999145',
        'Segunda Fibra ON': '1207075465845739', 'FTTR': '1209013973166418',
        'Dispositivos': '1204870126999105', 'Movistar Plus+': '1204870126999107',
        'M+ Deporte': '1204870126999108', 'M+ Futbol': '1204870126999109',
        'M+ Ficción': '1204870126999110', 'M+ Originales': '1204870126999111',
        'Prepago': '1204870126999112', 'Líneas Móviles Extra': '1204870126999113',
        'Solar360': '1204870126999114', 'Movistar Prosegur Alarmas': '1204870126999115',
        'Gaming': '1204870126999118', 'Conexión Segura': '1204878941839146',
        'Otros': '1204878941839148'
      }
    },
    formato: {
      gid: '1213308530190497', tipo: 'enum',
      options: {
        'Email y/o SMS': '1213308530190498', 'Banners TV': '1213308530190499',
        'Enews de contenidos TV': '1213308530190500',
        'Mailing y formatos offline': '1213308530190501',
        'Customer Journey': '1213785945935365', 'RCS': '1214631909658715',
        'Notificación Push': '1216508408439829'
      }
    },
    tipoCliente: {
      gid: '1204870126999123', tipo: 'multi_enum',
      options: {
        'Convergente': '1204870126999124', 'Solo Móvil': '1204870126999125',
        'Solo BAF': '1204870126999126', 'No Cliente': '1204870126999127',
        'HORECAS': '1209316062819362', 'Prepago Móvil': '1205121434259170',
        'Empleados': '1205169291951564'
      }
    },
    estado: {
      gid: '1204870126999131', tipo: 'enum',
      options: {
        'Pdte Comercialización': '1204870126999132',
        'Pdte creatividad': '1204870126999134',
        'En desarrollo': '1204934955525910',
        'Finalizado': '1204942258367960',
        'En Suspenso': '1204969494118743'
      }
    },
    peticionario: { gid: '1204870123950404', tipo: 'text' }
  },

  // Lo que se puede elegir en la revisión sale de los catálogos:
  // si no está en Asana, no se puede escribir.
  get productOptions()    { return Object.keys(this.fields.producto?.options || {}); },
  get formatOptions()     { return Object.keys(this.fields.formato?.options || {}); },
  get clientTypeOptions() { return Object.keys(this.fields.tipoCliente?.options || {}); },

  // Producto → Sección. Determinista. Punto único de configuración.
  productSectionMap: {
    'MiMovistar': 'convergente', 'Conexión Segura': 'convergente',
    'Fibra Adicional': 'conectividad', 'Segunda Fibra ON': 'conectividad',
    'FTTR': 'conectividad', 'Prepago': 'conectividad',
    'Líneas Móviles Extra': 'conectividad',
    'Dispositivos': 'dispositivos',
    'Movistar Plus+': 'plus', 'M+ Originales': 'plus',
    'M+ Ficción': 'ficcion', 'M+ Futbol': 'futbol', 'M+ Deporte': 'deportes',
    'Gaming': 'gaming',
    'Solar360': 'nuevos', 'Movistar Prosegur Alarmas': 'nuevos',
    'Otros': 'otros'
  },

  // Growth/Value/Servicing NO existe como campo en Asana. Se calcula
  // y se enseña en la revisión, pero al crear la tarea no se escribe
  // en ningún sitio. Hay que crear el campo en el proyecto.
  typologyOptions: ['Growth', 'Value', 'Servicing'],

  // Estado con el que nacen las tareas. PLACEHOLDER: está pendiente de
  // acordarlo entre los tres equipos (ver DECISIONES.md). Se cambia AQUÍ
  // y en ningún otro sitio.
  //
  // Ojo: el catálogo lista 26 estados pero los Tipos de tarea del
  // proyecto solo dejan escribir 12. El valor de aquí tiene que ser uno
  // de los que Asana acepta de verdad, y eso solo se sabe escribiendo.
  estadoInicial: 'Pdte Maquetación y envío - Movistar'
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
    'Carta Oficial':   'Mailing y formatos offline',
    'CARTA SAT':       'Mailing y formatos offline',
    'App Mi Movistar': 'Notificación Push'
  },

  // PRODUCTO / KPI (Excel) → Producto (Asana). Los nombres de la derecha
  // son opciones reales del campo: lo que no esté ahí no se puede escribir.
  productoProduct: {
    'Fibra Adicional':           'Fibra Adicional',
    'FTTR':                      'FTTR',
    'Alta BAF':                  'Fibra Adicional',
    'R2R':                       'Dispositivos',
    'Fútbol+':                   'M+ Futbol',
    'Deportes Total':            'M+ Deporte',
    'Ficción Total':             'M+ Ficción',
    'Movistar Plus+ (Paquete)':  'Movistar Plus+',
    'Atresplayer':               'Movistar Plus+',
    'Enews contenidos':          'Movistar Plus+',
    'Horecas /LLPP':             'Movistar Plus+',
    'Helios':                    'Otros',
    'Renting coche eléctrico':   'Otros',
    'eSIMFlag':                  'Otros',
    'Movistar Prosegur Alarmas': 'Movistar Prosegur Alarmas',
    'Legal':                     'Otros',   // no se importa (palancasOmitidas)
    'Marca':                     'Otros',
    'Info':                      'Otros'    // se afina con productoPorNombre
  },

  // PRODUCTO del Excel → Sección, cuando el producto de Asana no basta
  // para decidirla. El proyecto real tiene sección propia para Horecas,
  // Enews Marca y Enews Entretenimiento, que no son productos.
  productoSection: {
    'Horecas /LLPP':           'horecas',
    'Marca':                   'marca',
    'Enews contenidos':        'enewsM',
    'Helios':                  'nuevos',
    'Renting coche eléctrico': 'nuevos',
    'eSIMFlag':                'nuevos',
    'Atresplayer':             'plus'
  },

  // "Info" es cajón de sastre: producto y sección se reconocen por el
  // nombre. Primer patrón que casa, gana.
  productoPorNombre: [
    { pattern: /RED_SEGURA|RED SEGURA/i,      product: 'Conexión Segura', section: 'convergente' },
    { pattern: /SORTEO|CAMISETA|MUNDIAL/i,    product: 'M+ Futbol',       section: 'futbol' },
    { pattern: /APP_MIMOVISTAR.*CONTENIDOS/i, product: 'Movistar Plus+',  section: 'plus' }
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

  // Productos que fuerzan el formato aunque MEDIO diga E-Mailing.
  productoFormatOverride: {
    'Enews contenidos': 'Enews de contenidos TV'
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
