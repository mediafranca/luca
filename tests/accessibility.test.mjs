import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../ui/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../ui/app.js", import.meta.url), "utf8");

test("las superficies principales exponen nombres y roles accesibles", () => {
  assert.match(html, /id="tabs" role="tablist" aria-label="Documentos abiertos"/);
  assert.match(html, /id="prefs" hidden role="dialog" aria-modal="true" aria-labelledby="prefsTitle"/);
  assert.match(html, /id="commandQuery"[^>]+aria-label="Buscar comandos"/);
  assert.match(html, /id="commandResults" role="listbox" aria-label="Comandos disponibles"/);
});

test("el teclado recorre pestañas y el foco cerrado vuelve al disparador", () => {
  assert.match(app, /\["ArrowLeft", "ArrowRight", "Home", "End"\]\.includes\(e\.key\)/);
  assert.match(app, /e\.key === "Enter" \|\| e\.key === " "/);
  assert.match(app, /utilityDialogTrigger\?\.focus\?\.\(\)/);
  assert.match(app, /close\.setAttribute\("aria-label", `Cerrar /);
});

test("todos los controles interactivos tienen foco visible global", () => {
  assert.match(html, /:where\(button, select, input, textarea, \[tabindex\]\):focus-visible/);
});
