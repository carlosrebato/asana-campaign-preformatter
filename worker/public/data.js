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
/* ------------------------------------------------------------
   LOS APARTADOS DE UN BRIEF
   ------------------------------------------------------------
   Los briefs de Comercialización vienen con estructura, aunque cada
   equipo la nombre a su manera: "Territorio", "Territorio expresivo" y
   "Territorio (frases)" son lo mismo. Medido sobre 44 briefs de octubre:
   el tono aparece en 29, la idea fuerza en 23, qué evitar en 20. Solo 3
   no traen ningún apartado, y son justo los que son una lista de precios
   en vez de un brief.

   El modelo pone cada cosa en su campo; esta lista dice cómo se llaman y
   en qué orden se leen. Es vocabulario, no un mapeo: no decide nada.
------------------------------------------------------------ */
const CAMPOS_BRIEF = [
  ['ideaFuerza', 'Idea fuerza'],
  ['tono',       'Tono'],
  ['ejes',       'Ejes de mensaje'],
  ['reasonWhy',  'Reason why'],
  ['evitar',     'Qué evitar'],
  ['mandatorio', 'Mandatorio'],
  ['otros',      'Otros']
];

const CATALOGS = {
  esCopia: true,   // pasa a false cuando los catálogos vienen de Asana

  sections: [
    { id: 'entradas',     gid: '1204962417752693', name: '➡️ENTRADAS' },
    { id: 'priorizadas',  gid: '1209498548935703', name: '🔴 Campañas priorizadas y Creatividades' },
    // `otrosNombres` es la lista de nombres que esta sección ha tenido o
    // va a tener. Las secciones se emparejan POR NOMBRE con las que
    // devuelve Asana —los identificadores no sirven, porque el sandbox y
    // producción tienen los suyos— así que un nombre que no case deja la
    // sección sin reconocer y las tareas se crean sin sección, en
    // silencio. Pasó: al poner aquí el nombre nuevo antes de renombrarla
    // en Asana, ocho campañas de Conectividad se quedaron sueltas.
    //
    // Con los dos nombres, da igual el orden en que se hagan las cosas.
    { id: 'conectividad', gid: '1204996811344449',
      name: '⚙️ Conectividad: FTTR, BAF, LME, Prepago',
      otrosNombres: ['⚙️ Conectividad y equipamiento', 'Conectividad y equipamiento'] },
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
    objetivo:     'Objetivo de la campaña',
    peticionario: 'Peticionario'
  },

  fields: {
    // Las 26 opciones tal y como están en Asana (1-oct-2026). Esta copia
    // solo se usa cuando Asana no contesta; el catálogo bueno se lee del
    // proyecto. Llevaba meses con 17 y faltaban nueve, así que un mes sin
    // conexión habría mandado a Otros productos que sí existen.
    producto: {
      gid: '1204870126999103', tipo: 'multi_enum',
      options: {
        'MiMovistar': '1204870126999104', 'Fibra Adicional': '1204870126999145',
        'Segunda Fibra ON': '1207075465845739', 'FTTR': '1209013973166418',
        'Dispositivos': '1204870126999105',
        'Servicios Añadidos (Cloud, Conex. Segura,..)': '1204870126999106',
        'Movistar Plus+': '1204870126999107',
        'M+ Deporte': '1204870126999108', 'M+ Futbol': '1204870126999109',
        'M+ Ficción': '1204870126999110', 'M+ Originales': '1204870126999111',
        'Prepago': '1204870126999112', 'Líneas Móviles Extra': '1204870126999113',
        'Solar360': '1204870126999114', 'Movistar Prosegur Alarmas': '1204870126999115',
        'Ms. Salud': '1204870126999116', 'Ms. Car': '1204870126999117',
        'Gaming': '1204870126999118', 'Seguro Hogar': '1204870126999119',
        'Ms Money': '1204870126999120', 'Ms. Nextory': '1204870126999129',
        '5G/5G+': '1204878941839145', 'Conexión Segura': '1204878941839146',
        'Ms Cloud': '1204878941839147', 'ISR': '1207037193025204',
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
    objetivo: {
      gid: '1204870126999139', tipo: 'multi_enum',
      options: {
        'Captación': '1204870126999140', 'Desarrollo': '1204870126999141',
        'Activación': '1204870126999142', 'Fidelización': '1204870126999143'
      }
    },
    peticionario: { gid: '1204870123950404', tipo: 'text' }
  },

  // Lo que se puede elegir en la revisión sale de los catálogos:
  // si no está en Asana, no se puede escribir.
  get productOptions()    { return Object.keys(this.fields.producto?.options || {}); },
  get formatOptions()     { return Object.keys(this.fields.formato?.options || {}); },
  // clientTypeOptions se retiró con el campo: ver aPayloadAsana.

  /* ----------------------------------------------------------
     EN QUÉ ORDEN SE REVISAN LAS SECCIONES
     ----------------------------------------------------------
     Asana las devuelve en el orden en que alguien las creó hace años,
     que no es el orden en que se miran. Arriba lo que más volumen tiene
     y más hay que revisar; abajo lo recurrente.

     Octubre 2026, de 73 campañas: Fútbol 14, Dispositivos 10, Horecas 9,
     Conectividad 8, Nuevos Negocios 8, Enews 6+6, Plus+ 5, Deportes 5.

     Las dos Enews bajan aunque sumen 12: son newsletters recurrentes,
     casi idénticas cada semana, y son las que menos revisión piden.

     El orden no es solo volumen. Lo fijó Carlos el 30-sep-2026 y lo
     aprobó el equipo el 1-oct-2026: Fútbol y Dispositivos primero; luego
     Ficción y Deportes; después Conectividad y Plus+; y Horecas y
     Nuevos Negocios detrás, que mueven menos aunque tengan nueve y ocho
     campañas. Las dos Enews cierran el bloque aprobado.

     MIMOVISTAR estaba en esa lista y el equipo lo sacó: "ya no es
     necesario". Sale del bloque aprobado, pero NO se borra de aquí.
     La sección sigue existiendo en Asana y hay nueve productos de la
     lista de Comercialización que siguen apuntando ahí (Alta móvil,
     Alta miMovistar, Protección Digital…). En octubre no le toca
     ninguna campaña, pero el mes que caiga una tiene que ir a algún
     sitio, y que ese sitio sea el final de la lista es mejor que un
     silencio. Si MIMOVISTAR se retira de verdad, lo que hay que decidir
     es a qué sección van esos nueve productos, y eso lo dice
     Comercialización, no este fichero.

     Esto es una decisión de negocio, no técnica. Se cambia aquí, y una
     sección que no esté en la lista va al final sin romper nada.
  ---------------------------------------------------------- */
  ordenSecciones: [
    // Lo aprobado por el equipo, en su orden.
    'futbol', 'dispositivos',
    'ficcion', 'deportes', 'conectividad', 'plus', 'horecas', 'nuevos',
    'enewsM', 'marca',
    // Lo que no entró en la lista: va detrás, por orden de cuánto se mira.
    'convergente', 'gaming', 'beneficios', 'priorizadas', 'entradas', 'otros'
  ],

  // Las secciones tal y como se revisan. El catálogo llega de Asana con
  // su orden; aquí se pone el nuestro.
  get seccionesOrdenadas() {
    const pos = id => {
      const i = this.ordenSecciones.indexOf(id);
      return i === -1 ? this.ordenSecciones.length : i;
    };
    return [...this.sections].sort((a, b) => pos(a.id) - pos(b.id));
  },

  // Producto → Sección. Determinista. Punto único de configuración.
  // MiMovistar y Conexión Segura apuntaban a la sección MIMOVISTAR
  // (Convergente). El equipo la retiró el 1-oct-2026 y Carlos decidió
  // que todo lo que iba ahí pasa a Conectividad. La sección sigue
  // existiendo en Asana, pero ya no le llega nada desde aquí.
  productSectionMap: {
    'MiMovistar': 'conectividad', 'Conexión Segura': 'conectividad',
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

  // Palancas del Excel. Se enseñan en la revisión y se escriben en el
  // campo "Objetivo de la campaña" de Asana, que tiene las mismas
  // categorías con otro nombre.
  //
  // Las cuatro primeras son la lista cerrada de Comercialización (Lista
  // de Productos Palancas Medios v3, Eduardo). `Prevención` faltaba
  // aquí aunque sí estaba en las dos tablas de abajo: una campaña de
  // prevención se revisaba con el cartel de "no existe en Asana, elige
  // otro" encima, que es justo lo contrario de lo que pasa.
  //
  // `Legal` no viene en la lista de Eduardo y se deja a propósito: lo
  // dijo Carlos (30-sep-2026). Ojo con una incoherencia que sigue viva:
  // las filas con palanca Legal no se importan (`palancasOmitidas`), así
  // que Legal solo puede llegar a una tarea si alguien la elige a mano
  // en la revisión. Está por decidir si eso es lo que se quiere.
  palancaOptions: ['Captación No Cliente', 'Desarrollo', 'Fidelización/Dinamización', 'Prevención', 'Legal'],
  palancaObjetivo: {
    'Desarrollo':                'Desarrollo',
    'Captación No Cliente':      'Captación',
    'Fidelización/Dinamización': 'Fidelización',
    // SUPUESTO, pendiente de que lo confirme Comercialización: retener a
    // quien se iba a ir es fidelizar. Si dicen otra cosa, se cambia aquí.
    'Prevención':                'Fidelización'
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
  estadoInicial: 'Pdte Maquetación y envío - Movistar',

  /* ----------------------------------------------------------
     EL PETICIONARIO ES UN CORREO, NO UN NOMBRE
     ----------------------------------------------------------
     El Excel trae "INES MOLINERO MARTIN" en mayúsculas. Asana
     guarda "ines.molineromartin@telefonica.com": así está en
     todas las tareas que ya existen en producción.

     Hubo una regla que lo deducía del nombre y acertaba nueve de
     cada diez. La décima era María Carla Sanz Esteban, que firma
     `carla.sanzesteban` y no `mariacarla.sanzesteban`. No es una
     convención de Telefónica, es cómo se llama ella, y eso no hay
     regla que lo saque.

     Así que no se deduce: se mira. Estos son los interlocutores
     de Comercialización con el correo que usan de verdad, que los
     comprobó Carlos en el directorio el 1-oct-2026.

     Quien no esté aquí sale sin peticionario y con un aviso que
     dice su nombre. Es la misma decisión que con los productos:
     se cierra en origen, no se adivina. Añadir a alguien es una
     línea y no hay que tocar código.
  ---------------------------------------------------------- */
  correosConocidos: {
    'ANA MARIA ARIZPELETA IRIARTE': 'anamaria.arizpeletairiarte@telefonica.com',
    'INES MOLINERO MARTIN':         'ines.molineromartin@telefonica.com',
    'MARIA BLANCA CABEZON NORES':   'mariablanca.cabezonnores@telefonica.com',
    'MARIA CARLA SANZ ESTEBAN':     'carla.sanzesteban@telefonica.com',
    'MARTA MARIN DE LAS HERAS':     'marta.marindelasheras@telefonica.com',
    'MONTSERRAT BRUNA IGLESIAS':    'montserrat.brunaiglesias@telefonica.com',
    'SARA SANCHEZ RUBIO':           'sara.sanchezrubio@telefonica.com',
    'SONIA VILLAR PASCUAL':         'sonia.villarpascual@telefonica.com',
    'SUSANA APARICIO GRACIA':       'susana.apariciogracia@telefonica.com',
    'YOLANDA MORENO PIMENTEL':      'yolanda.morenopimentel@telefonica.com'
  }
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
    // Prevención tiene algo de servicing, pero no es excluyente: como
    // palanca pertenece a Value, no a Growth (dicho por Carlos, que es
    // quien lo sabe, 29-sep-2026).
    'Prevención':                'Value',
    'Legal':                     'Servicing'
  },



  // MEDIO (Excel) → Formato (Asana).
  //
  // La columna MEDIO es texto libre y Comercialización escribe lo que
  // necesita: "e-Mailing_SMS", "App M+", combinaciones de dos o tres.
  // No se les puede pedir que se ciñan a una lista nuestra — la única
  // lista que manda es la del campo de Asana, y es corta y fija.
  //
  // Así que en vez de comparar la celda entera, se buscan fragmentos.
  // Gana el primero que aparece, por eso el orden importa: "e-mailing"
  // tiene que mirarse antes que "mailing".
  //
  // Nota: "Email y/o SMS" YA es una combinación en Asana, así que
  // "e-Mailing_SMS" no necesita ninguna opción nueva.
  medioFragmentos: [
    [/rcs/,                          'RCS'],
    [/enews|e-news/,                 'Enews de contenidos TV'],
    [/banner/,                       'Banners TV'],
    [/push|notificaci/,              'Notificación Push'],
    [/\bapp\b/,                      'Notificación Push'],
    [/journey|\bcj\b/,               'Customer Journey'],
    [/e-?mailing|e-?mail|@/,         'Email y/o SMS'],
    [/\bsms\b/,                      'Email y/o SMS'],
    // "mailing" solo cuenta como envío físico si va suelto: en
    // "e-Mailing" es un correo electrónico, no una carta.
    [/carta|buzoneo|folleto|offline|(^|\s)mailing/, 'Mailing y formatos offline']
  ],

  // PRODUCTO / KPI (Excel) → Producto (Asana). Los nombres de la derecha
  // son opciones reales del campo: lo que no esté ahí no se puede escribir.
  // PRODUCTO / KPI (Excel) → Producto (Asana). Los nombres de la derecha
  // son opciones reales del campo: lo que no esté ahí no se puede escribir.
  //
  // La lista de la izquierda la cerró Comercialización el 30-sep-2026
  // ("Lista de Productos Palancas Medios v3"): son 56 valores y no hay
  // más. Por eso esto puede ser una tabla y no una adivinanza — antes la
  // lista era abierta y cada mes aparecía un valor nuevo.
  productoProduct: {
    // Conectividad
    'Fibra Adicional':            'Fibra Adicional',
    'Fibra Adicional Autónomos':  'Fibra Adicional',
    'Activación Segunda Fibra':   'Segunda Fibra ON',
    'FTTR':                       'FTTR',
    'Alta BAF':                   'Fibra Adicional',
    'Prepago':                    'Prepago',
    // AFR5G es acceso fijo por radio, y es su propio producto: no es
    // "5G/5G+", que es móvil. Carlos pidió añadirlo el 1-oct-2026.
    //
    // Se pone ya aunque la opción todavía no exista en Asana: el lector
    // comprueba contra el catálogo de verdad y, mientras no esté, manda
    // la campaña a Otros y lo dice. El día que alguien cree la opción
    // en Asana, esto empieza a funcionar sin tocar una línea.
    'AFR5G':                      'AFR5G',
    'Migración Tecnológica':      'Otros',

    // miMovistar
    'Alta miMovistar':            'MiMovistar',
    'Alta Móvil':                 'MiMovistar',
    'miMovistar Autónomos':       'MiMovistar',
    'Upsell Fusión/miMovistar':   'MiMovistar',
    'App Mi Movistar':            'MiMovistar',
    'Conecta Max':                'MiMovistar',
    'Movistar Conecta':           'MiMovistar',

    // Dispositivos
    'R2R':                        'Dispositivos',
    'Equipamiento Hogar':         'Dispositivos',
    'Router / Desco WiFi':        'Dispositivos',
    'Enews dispositivos':         'Dispositivos',
    'Libres':                     'Dispositivos',

    // Televisión y contenidos
    'Movistar Plus+ (Paquete)':   'Movistar Plus+',
    'Movistar Plus+ (OTT)':       'Movistar Plus+',
    'Contratación Paquetes TV':   'Movistar Plus+',
    'Atresplayer':                'Movistar Plus+',
    'Netflix':                    'Movistar Plus+',
    'Disney+':                    'Movistar Plus+',
    'Prime Video':                'Movistar Plus+',
    'Enews contenidos':           'Movistar Plus+',
    'Horecas /LLPP':              'Movistar Plus+',
    'Fútbol+':                    'M+ Futbol',
    'Champions':                  'M+ Futbol',
    'LaLiga':                     'M+ Futbol',
    'Deportes Total':             'M+ Deporte',
    'Motor':                      'M+ Deporte',
    'Baloncesto':                 'M+ Deporte',
    'DAZN':                       'M+ Deporte',
    'Ficción Total':              'M+ Ficción',
    'Ficción con Disney+':        'M+ Ficción',

    // Seguridad y servicios
    'Protección Digital':         'Conexión Segura',
    'Protección Digital Integral':'Conexión Segura',
    'Movistar Prosegur Alarmas':  'Movistar Prosegur Alarmas',
    'Solar360':                   'Solar360',
    'Xbox Gamepass':              'Gaming',
    'eSIMFlag':                   'Otros',
    'Helios':                     'Otros',
    'Renting coche eléctrico':    'Otros',
    'Movistar Cloud':             'Otros',
    'Servicios Digitales':        'Otros',
    'Chat GPT':                   'Otros',
    'Perplexity':                 'Otros',
    'Nextory':                    'Otros',
    'Seguro Hogar':               'Otros',
    'Seguro Móvil':               'Otros',
    'Eventos':                    'Otros',
    'Tráfico a Tienda':           'Otros',

    // Transversales
    'Legal':                      'Otros',   // no se importa (palancasOmitidas)
    'Marca':                      'Otros',
    'Info':                       'Otros'    // se afina con productoPorNombre
  },

  // PRODUCTO del Excel → Sección, cuando el producto de Asana no basta
  // para decidirla. El proyecto real tiene sección propia para Horecas,
  // Enews Marca y Enews Entretenimiento, que no son productos.
  productoSection: {
    'AFR5G':                   'conectividad',
    'Migración Tecnológica':   'conectividad',
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
  // Se mira SIEMPRE, no solo cuando el producto es "Info". El Excel
  // trae a veces un producto que no es el de la campaña: "Encendido red
  // 5G" viene como R2R —que es renovación de dispositivos— y acababa en
  // Dispositivos hablando de encender la red. Carlos lo confirmó el
  // 1-oct-2026: no es dispositivos.
  //
  // Esto es una puerta de atrás, y las puertas de atrás se usan poco y
  // con patrones estrechos: el primero que casa gana y se come lo que
  // diga la tabla de productos.
  productoPorNombre: [
    { pattern: /RED_SEGURA|RED SEGURA/i,      product: 'Conexión Segura', section: 'conectividad' },
    { pattern: /ENCENDIDO\s+RED\s*5G/i,       product: '5G/5G+',          section: 'conectividad' },
    { pattern: /SORTEO|CAMISETA|MUNDIAL/i,    product: 'M+ Futbol',       section: 'futbol' },
    { pattern: /APP_MIMOVISTAR.*CONTENIDOS/i, product: 'Movistar Plus+',  section: 'plus' }
  ],

  // Aquí vivía `productoBrief`: una tabla escrita a mano que decía qué
  // brief le tocaba a cada producto. Se quedó muerta cuando el modelo
  // pasó a decidirlo leyendo, y muerta se quedó meses. Se borra:
  // mantener una tabla que nadie usa es prometer un mapeo que no existe.


  // PRODUCTO del Excel → territorio del documento de orientación.
  // Solo se usa cuando no hay brief de Comercialización: es material
  // derivado y va siempre en amarillo. Un producto sin entrada aquí se
  // queda sin contexto, que sigue siendo el caso normal.
  productoTerritorio: {
    'R2R':                       'Smartphone (iPhone + Swap)',
    'Fútbol+':                   'Desarrollo y upsell de fútbol',
    'Horecas /LLPP':             'Horecas',
    'Deportes Total':            'Deportes / Motor / Baloncesto',
    'Ficción Total':             'Nuevo Ficción (Full Ficción)',
    'Fibra Adicional':           'FTTR / Fibra Adicional / Segunda Fibra',
    'FTTR':                      'FTTR / Fibra Adicional / Segunda Fibra',
    'Alta BAF':                  'Ganancia OC y BAF Stand Alone',
    'eSIMFlag':                  'Renting coches / Helios / MPA / eSimFLAG',
    'Renting coche eléctrico':   'Renting coches / Helios / MPA / eSimFLAG',
    'Helios':                    'Renting coches / Helios / MPA / eSimFLAG',
    'Movistar Prosegur Alarmas': 'Renting coches / Helios / MPA / eSimFLAG'
  },

  // Productos que fuerzan el formato aunque MEDIO diga E-Mailing.
  productoFormatOverride: {
    'Enews contenidos': 'Enews de contenidos TV'
  }
};

/* ------------------------------------------------------------
   EXCEL DE BANNERS DE MOVISTAR PLUS+ → ASANA
   ------------------------------------------------------------
   Otro fichero, otra lógica. El de Comercialización es una tabla:
   1 fila = 1 campaña. Este es una parrilla: las filas son
   posiciones del menú y las columnas semanas, y lo que dice si
   hay tarea o no es EL COLOR DE LA CELDA.

   Reglas, tal y como las dieron Bárbara y Eduardo (30-sep-2026):

   - Verde = creatividad nueva, hay que producirla → tarea.
   - Blanco = creatividad reutilizada → no hay tarea.
   - CORPO = campaña corporativa, no es nuestra → no hay tarea.
   - Cuatro posiciones: 4, 6, dispositivos 4 y dispositivos 6.
   - La entrega es cuando se entrega al Plus: n-3 laborables
     antes de que el banner se publique.

   El verde NO es un verde. En el fichero de octubre hay tres tonos
   distintos, porque cada quien pinta con el suyo. Comparar contra una
   lista de colores concretos es lo que hacía que faltaran tareas; se
   pregunta por el tono (¿es un verde?), no por el color exacto.
------------------------------------------------------------ */
const BANNERS = {
  // La hoja buena es la visible. Las otras son material de trabajo
  // (V1, dispositivos seleccionados) y están ocultas a propósito.
  hojaPatron: /banner/i,

  // Columnas de la parrilla. Se localizan por contenido, no por letra:
  // las semanas por la cabecera 'S40', y el resto por su rótulo.
  semanaPatron: /^S\s*(\d{1,2})$/i,
  rotulos: {
    origen:   /origen\s*cliente/i,
    producto: /objetivo\s*\/?\s*producto/i
  },
  // La franja horaria del banner vive en su propia columna, sin rótulo.
  franjaPatron: /^\s*([LJ])\s*-\s*([XD])\s*$/i,

  // Qué día se publica cada franja, contando desde el lunes de su semana.
  franjas: {
    'L-X': { dia: 0, texto: 'lunes a miércoles' },
    'J-D': { dia: 3, texto: 'jueves a domingo' }
  },

  // Cabecera de posición en la primera columna. 'DISPOSITIVOS' no dice
  // si es la 4 o la 6: eso lo dice el 'Menutelef 4A' / 'menutelef6' de
  // las columnas de origen y producto.
  posicionPatron: /^\s*POSICI[OÓ]N\s*(\d+)/i,
  dispositivosPatron: /^\s*DISPOSITIVOS\s*$/i,
  menutelefPatron: /menutelef\s*(\d+)/i,

  // Texto que anula la celda aunque esté pintada.
  ignorar: /^\s*CORPO\s*$/i,

  // Días laborables de antelación con los que se entrega al Plus.
  entregaLaborables: 3,

  // Festivos de 2026 en Madrid capital, que es donde se entrega. Un
  // "día laborable" no es un día entre semana: si cae festivo, la
  // entrega se adelanta.
  //
  // Son los catorce: los nacionales, los dos de la Comunidad (Decreto
  // 75/2025, BOCM de 25-sep-2025) y los dos locales de la ciudad de
  // Madrid. Dos van trasladados porque caían en domingo.
  //
  // Esto caduca cada año. En diciembre hay que poner los de 2027, y si
  // no se ponen, las entregas de enero saldrán un día tarde.
  festivos: [
    '2026-01-01',   // Año Nuevo
    '2026-01-06',   // Reyes
    '2026-04-02',   // Jueves Santo · Comunidad de Madrid
    '2026-04-03',   // Viernes Santo
    '2026-05-01',   // Fiesta del Trabajo
    '2026-05-02',   // Día de la Comunidad de Madrid (cae sábado)
    '2026-05-15',   // San Isidro · ciudad de Madrid
    '2026-08-15',   // Asunción (cae sábado)
    '2026-10-12',   // Fiesta Nacional
    '2026-11-02',   // Todos los Santos, trasladado del domingo 1
    '2026-11-09',   // La Almudena · ciudad de Madrid
    '2026-12-07',   // Constitución, trasladado del domingo 6
    '2026-12-08',   // Inmaculada
    '2026-12-25'    // Navidad
  ],

  // Todos los banners son banners.
  formato: 'Banners TV',

  // Qué producto de Asana es cada banner. Se mira PRIMERO el texto de
  // la propia celda —que dice de qué va la creatividad— y solo si ahí
  // no hay nada, la columna de producto del bloque. Primer patrón que
  // casa, gana, así que el orden importa: lo específico arriba.
  //
  // `section` solo se pone cuando la sección NO se deduce del producto.
  // Es el mismo caso que EXCEL.productoPorNombre: eSIM Flag se escribe
  // en Asana como "Otros" pero se revisa en Nuevos Negocios, y si no se
  // dice aquí acabaría en la sección de cajón de sastre.
  productoPorTexto: [
    { pattern: /CL[AÁ]SICO|LALIGA|LA LIGA|CHAMPIONS|F[UÚ]TBOL|FUTBOL/i, product: 'M+ Futbol' },
    { pattern: /FICCI[OÓ]N|NETFLIX|DISNEY|ESTRENO|SERIE/i,              product: 'M+ Ficción' },
    { pattern: /BALONCESTO|NBA|MOTOR|F1|GP |TENIS|MASTERS|GOLF|DEPORTE/i, product: 'M+ Deporte' },
    { pattern: /IPHONE|ANDROID|BODEGON|BODEG[OÓ]N|DISPOSITIVO|SWAP|GOOGLE/i, product: 'Dispositivos' },
    { pattern: /FTTR/i,                                                 product: 'FTTR' },
    { pattern: /FIBRA ADICIONAL/i,                                      product: 'Fibra Adicional' },
    { pattern: /SEGUNDA FIBRA/i,                                        product: 'Segunda Fibra ON' },
    { pattern: /RED SEGURA|CONEXI[OÓ]N SEGURA/i,                        product: 'Conexión Segura' },
    { pattern: /ESIM/i,                                product: 'Otros', section: 'nuevos' },
    { pattern: /MPA|PROSEGUR|ALARMA/i,                                  product: 'Movistar Prosegur Alarmas' },
    { pattern: /SOLAR/i,                                                product: 'Solar360' },
    { pattern: /PREPAGO/i,                                              product: 'Prepago' },
    { pattern: /L[IÍ]NEAS? M[OÓ]VIL/i,                                  product: 'Líneas Móviles Extra' },
    { pattern: /MOVISTAR PLUS|M\+|ORIGINALES/i,                         product: 'Movistar Plus+' },
    { pattern: /MIMOVISTAR|R2R|RENOVE/i,                                product: 'MiMovistar' }
  ]
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
