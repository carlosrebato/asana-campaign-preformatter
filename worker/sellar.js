#!/usr/bin/env node
/* ============================================================
   Campaign Loader · Sellar los ficheros antes de desplegar
   ------------------------------------------------------------
   El navegador guarda el CSS y el JS. Las cabeceras de _headers
   ya le dicen que pregunte antes de usarlos, pero index.html los
   pide con un sello (`api.js?v=...`) que hasta ahora se ponía a
   mano. Un sello a mano es un paso que alguien olvida, y el día
   que se olvida la gente ve una versión vieja y cree que la
   herramienta está rota.

   Esto lo pone solo: el sello es un resumen del contenido del
   propio fichero. Si el fichero no cambia, el sello no cambia y
   el navegador reutiliza lo que tiene. Si cambia una coma, el
   sello cambia y la dirección es otra, así que no hay caché que
   valga.

   Se ejecuta solo al desplegar (`npm run deploy`). Si se ejecuta
   suelto (`npm run sellar`) dice qué cambiaría.
============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLICO = path.join(__dirname, 'public');
const INDICE = path.join(PUBLICO, 'index.html');

const resumen = fichero =>
  crypto.createHash('sha256').update(fs.readFileSync(fichero)).digest('hex').slice(0, 10);

function sellar() {
  let html = fs.readFileSync(INDICE, 'utf8');
  const cambios = [];

  // Cada href/src local que ya pide un sello, o que podría pedirlo.
  html = html.replace(
    /((?:href|src)=")([A-Za-z0-9_.-]+\.(?:css|js))(?:\?v=[^"]*)?(")/g,
    (todo, antes, fichero, despues) => {
      const ruta = path.join(PUBLICO, fichero);
      if (!fs.existsSync(ruta)) {
        console.error(`  ! ${fichero} está enlazado en index.html y no existe`);
        process.exitCode = 1;
        return todo;
      }
      const sello = resumen(ruta);
      const nuevo = `${antes}${fichero}?v=${sello}${despues}`;
      if (nuevo !== todo) cambios.push(`${fichero} → ${sello}`);
      return nuevo;
    }
  );

  if (!cambios.length) {
    console.log('Sellos al día, no hay nada que cambiar.');
    return false;
  }
  fs.writeFileSync(INDICE, html);
  console.log(`Sellados ${cambios.length} ficheros:`);
  cambios.forEach(c => console.log('  ·', c));
  return true;
}

sellar();
