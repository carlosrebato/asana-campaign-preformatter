/* ============================================================
   REPRODUCIR UNA PASADA GRABADA
   ============================================================
   Esto NO simula nada ni se inventa números: es la pasada real
   del 2 de octubre de 2026 —los mismos pasos, los mismos textos
   y las mismas cuentas— reproducida a mayor velocidad.

   Existe por una razón concreta: enseñar la herramienta a una
   sala. La pasada de verdad tarda nueve minutos porque se lee
   350 páginas, y nadie se queda mirando una barra nueve minutos.
   En la vida real tampoco: se procesa un día y se revisa otro.

   Reglas que se puso esto para no convertirse en una mentira:

   · Solo se activa con ?demo=<propuesta> en la dirección. Sin
     eso, este fichero ni se carga.
   · Los textos son literales de la pasada grabada. Si alguien
     pregunta "¿esto es real?", la respuesta honesta es "es la
     pasada de esta mañana, acelerada".
   · Las cuentas cuadran con lo que se ve después en la revisión,
     porque salen de la misma pasada. Inventarlas habría dejado
     un número que no encaja con el de la pantalla siguiente.
   · Al terminar abre la propuesta de verdad. Lo que se revisa y
     lo que se carga en Asana no tiene nada de grabado.

   Si algún día se quiere regrabar, se anotan los pasos reales de
   una pasada y se sustituye GRABACION. Los segundos son los que
   duró de verdad; la velocidad se decide al reproducir.
------------------------------------------------------------ */

const GRABACION = {
  fecha: '2 de octubre de 2026',
  segReales: 551,
  pasos: [
    { seg:   2, paso: 0, detalle: 'Leyendo el Excel de campañas', cuenta: '' },
    { seg:   8, paso: 0, detalle: 'Leyendo la parrilla de banners', cuenta: '' },
    { seg:  14, paso: 1, detalle: 'Documento 1 de 3 · 202609 Plan Comercial octubre.pdf', cuenta: '1 de 3', hechas: 0, total: 24 },
    { seg:  91, paso: 1, detalle: 'Documento 1 de 3 · 202609 Plan Comercial octubre.pdf', cuenta: '1 de 3', hechas: 4, total: 24 },
    { seg: 137, paso: 1, detalle: 'Documento 2 de 3 · Comunicación dispositivos octubre 2026.pdf', cuenta: '2 de 3', hechas: 5, total: 24 },
    { seg: 183, paso: 1, detalle: 'Documento 3 de 3 · Orientación comercial octubre 2026.html', cuenta: '3 de 3', hechas: 11, total: 24 },
    { seg: 274, paso: 1, detalle: 'Documento 3 de 3 · Orientación comercial octubre 2026.html', cuenta: '3 de 3', hechas: 13, total: 24 },
    { seg: 320, paso: 1, detalle: 'Documento 3 de 3 · Orientación comercial octubre 2026.html', cuenta: '3 de 3', hechas: 18, total: 24 },
    { seg: 411, paso: 1, detalle: 'Documento 3 de 3 · Orientación comercial octubre 2026.html', cuenta: '3 de 3', hechas: 23, total: 24 },
    { seg: 456, paso: 2, detalle: 'Juntando lo que es el mismo territorio · 57 briefs', cuenta: '' },
    { seg: 470, paso: 2, detalle: '34 territorios de 3 documentos', cuenta: '18 de 34' },
    { seg: 490, paso: 3, detalle: '43 entradas en el índice del mes', cuenta: '12 de 69' },
    { seg: 503, paso: 3, detalle: '43 entradas en el índice del mes', cuenta: '34 de 69' },
    { seg: 525, paso: 3, detalle: '43 entradas en el índice del mes', cuenta: '58 de 69' },
    { seg: 541, paso: 4, detalle: 'Comprobando qué hay ya en Asana', cuenta: '111 de 111' },
    { seg: 551, paso: 5, detalle: '', cuenta: '' }
  ]
};

window.DEMO = {
  grabacion: GRABACION,

  // ¿Hay que reproducir? Devuelve la propuesta a abrir, o ''.
  propuesta() {
    return new URLSearchParams(location.search).get('demo') || '';
  },

  // Cuántos segundos debe durar la reproducción. Por defecto 45.
  duracion() {
    const n = Number(new URLSearchParams(location.search).get('seg'));
    return Number.isFinite(n) && n >= 5 && n <= 600 ? n : 45;
  },

  // Reproduce, llamando a `pinta` en cada paso. El reloj que ve la
  // sala es el de la pasada real, no el de la reproducción: si
  // enseñara 7 segundos cuando dice "3 de 3 documentos", cantaría.
  async reproducir(pinta) {
    const factor = this.duracion() / GRABACION.segReales;
    let anterior = 0;
    for (const p of GRABACION.pasos) {
      await new Promise(r => setTimeout(r, (p.seg - anterior) * factor * 1000));
      anterior = p.seg;
      pinta({ ...p, segGrabados: p.seg });
    }
  }
};
