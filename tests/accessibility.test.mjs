import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../ui/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../ui/app.js", import.meta.url), "utf8");

test("las superficies principales exponen nombres y roles accesibles", () => {
  assert.match(html, /id="tabs" role="tablist" aria-label="Documentos abiertos"/);
  // Preferencias dejó de ser un diálogo modal: es una página con nombre
  // accesible (región) y su menú de categorías es un nav etiquetado.
  assert.match(html, /<section id="prefs"[^>]*hidden[^>]*aria-labelledby="prefsTitle"/);
  assert.match(html, /class="prefs-nav" aria-label="Categorías de preferencias"/);
  assert.match(html, /id="designList"[^>]*role="listbox" aria-label="Diseños guardados"/);
  assert.match(html, /id="commandQuery"[^>]+aria-label="Buscar comandos"/);
  assert.match(html, /id="commandResults" role="listbox" aria-label="Comandos disponibles"/);
});

test("el teclado recorre pestañas y el foco cerrado vuelve al disparador", () => {
  assert.match(app, /\["ArrowLeft", "ArrowRight", "Home", "End"\]\.includes\(e\.key\)/);
  assert.match(app, /e\.key === "Enter" \|\| e\.key === " "/);
  assert.match(app, /utilityDialogTrigger\?\.focus\?\.\(\)/);
  assert.match(app, /close\.setAttribute\("aria-label", t\("ui\.tab\.close_named"/);
});

test("todos los controles interactivos tienen foco visible global", () => {
  assert.match(html, /:where\(button, select, input, textarea, \[tabindex\]\):focus-visible/);
});
