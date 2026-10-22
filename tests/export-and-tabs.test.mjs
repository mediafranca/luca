import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// En Windows el checkout entrega CRLF: se normaliza para que los patrones
// que cruzan líneas no dependan del fin de línea del clon.
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const app = read("ui/app.js");
const main = read("src-tauri/src/main.rs");

// El menú nativo trae CmdOrCtrl+E, que en macOS es sólo ⌘E; el atajo del
// frontend cubre además Ctrl+E, que CodeMirror se quedaba para fin de línea.
test("exportar a PDF responde al menú nativo y al atajo del frontend", () => {
  // La etiqueta la pone el catálogo; aquí importa que el acelerador siga ahí.
  assert.match(main, /item\(\s*"export_pdf",\s*&lbl\("file\.export_pdf".*Some\("CmdOrCtrl\+E"\)/s);
  assert.match(app, /else if \(k === "e"\) \{ e\.preventDefault\(\); exportPdf\(\); \}/);
  // Dos vías para la misma acción: sin guarda, un doble disparo abriría dos
  // diálogos de impresión.
  assert.match(app, /if \(!active \|\| pdfBusy\) return;/);
});

// Los colores de un diagrama Mermaid quedan horneados en el SVG: con el tema
// oscuro el papel recibía trazos claros sobre blanco.
test("el PDF se imprime con la paleta clara y devuelve el tema de la pantalla", () => {
  const body = app.slice(app.indexOf("async function exportPdf"));
  const fin = body.slice(0, body.indexOf("\n}\n") + 3);
  assert.match(fin, /const toLight = isCurrentDark\(\)/);
  assert.match(fin, /root\.setAttribute\("data-theme", "light"\); initMermaid\(\);/);
  assert.match(fin, /await renderDoc\(active, true\);/);
  // La restitución vive en finally: un fallo al imprimir no puede dejar la app
  // clavada en claro ni con el @page inyectado.
  assert.match(fin, /\} finally \{/);
  assert.match(fin, /st\.remove\(\);/);
  assert.match(fin, /root\.removeAttribute\("data-theme"\)/);
  assert.match(fin, /root\.setAttribute\("data-theme", prevTheme\)/);
});

// activate() rehace la barra con replaceChildren: activar en mousedown mataba
// el nodo a mitad del gesto y dragstart no llegaba a dispararse nunca.
test("la pestaña se activa al click para no romper el arrastre que reordena", () => {
  assert.match(app, /tab\.addEventListener\("click", \(\) => activate\(doc\)\);/);
  assert.doesNotMatch(app, /tab\.addEventListener\("mousedown", \(\) => activate\(doc\)\);/);
  assert.match(app, /tab\.addEventListener\("dragstart"/);
  assert.match(app, /reorderTab\(draggedTabId, doc\.id, placement\);/);
});
