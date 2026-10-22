import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { externalWebUrl, isEditablePreviewMode, isInternalAnchor, scopeWikiCss } from "../ui/preview-behavior.js";

test("envía enlaces web absolutos al navegador del sistema", () => {
  assert.equal(externalWebUrl("https://mediafranca.net/luca"), "https://mediafranca.net/luca");
  assert.equal(externalWebUrl("http://example.org"), "http://example.org/");
  assert.equal(externalWebUrl("//example.org/a", "https://luca.invalid/"), "https://example.org/a");
});

test("deja anclajes y rutas locales dentro de Luca", () => {
  assert.equal(externalWebUrl("#instalacion"), null);
  assert.equal(isInternalAnchor("#instalacion"), true);
  assert.equal(isInternalAnchor(" https://example.org"), false);
  assert.equal(externalWebUrl("capitulo.md"), null);
  assert.equal(externalWebUrl("./imagen.png"), null);
  assert.equal(externalWebUrl("mailto:hola@example.org"), null);
});

test("la edición renderizada está disponible en vista mixta y completa", () => {
  assert.equal(isEditablePreviewMode("source"), false);
  assert.equal(isEditablePreviewMode("split"), true);
  assert.equal(isEditablePreviewMode("rendered"), true);
});

test("la hoja de la wiki se reancla al shadow root sin tocar sus clases", () => {
  // Los tokens de la wiki viven en :root; dentro del shadow root hay que
  // colgarlos de :host o no pinta nada.
  assert.equal(scopeWikiCss(":root{--sn-papel-50:#fcfbf7}"), ":host{--sn-papel-50:#fcfbf7}");
  assert.equal(scopeWikiCss("html,body{margin:0}"), ":host,.wiki-body{margin:0}");
  assert.equal(scopeWikiCss("body .mw-parser-output{color:red}"), ".wiki-body .mw-parser-output{color:red}");
  assert.equal(scopeWikiCss("@media print{:root{--x:1}}"), "@media print{:host{--x:1}}");

  // Clases y ids que sólo contienen la palabra no se reescriben.
  for (const intacto of [".mw-body{a:1}", "#bodyContent{a:1}", ".mw-body-content{a:1}", "[class*=body]{a:1}"]) {
    assert.equal(scopeWikiCss(intacto), intacto);
  }
  // Las rutas de url() quedan como están.
  assert.equal(scopeWikiCss("a{background:url(/w/body.png)}"), "a{background:url(/w/body.png)}");
});

// Un @font-face dentro de un shadow root no se registra: la familia la resuelve
// el @font-face del documento, y Luca empaqueta las que pide la wiki.
test("los @font-face de la wiki se descartan y la familia se conserva", () => {
  const css = "@font-face{font-family:'IBM Plex Sans';src:url(/skins/x.woff2) format('woff2')}"
    + ":root{--sn-font-sans:'IBM Plex Sans',system-ui,sans-serif}"
    + "body{font-family:var(--sn-font-sans)}";
  const out = scopeWikiCss(css);
  assert.doesNotMatch(out, /@font-face/);
  // Lo que importa sobrevive: la variable y quien la usa.
  assert.match(out, /:host\{--sn-font-sans:'IBM Plex Sans',system-ui,sans-serif\}/);
  assert.match(out, /\.wiki-body\{font-family:var\(--sn-font-sans\)\}/);
});

// data-wiki-styles suelta el padding del panel para que la medida la ponga la
// wiki. Si la bandera sobrevive a un cambio de formato, el Markdown se queda
// sin márgenes y el texto llega al borde.
test("la bandera de estilos de wiki se limpia antes de ramificar por formato", () => {
  const app = readFileSync(new URL("../ui/app.js", import.meta.url), "utf8");
  const pone = [...app.matchAll(/setAttribute\("data-wiki-styles"/g)];
  const quita = [...app.matchAll(/removeAttribute\("data-wiki-styles"\)/g)];
  assert.equal(pone.length, 1, "sólo showWikiHtml debe poner la bandera");
  assert.equal(quita.length, 1, "una sola limpieza, no una por rama");

  const render = app.indexOf("async function renderDoc");
  const rama = app.indexOf('if (doc.format === "wikitext")', render);
  assert.ok(render !== -1 && rama !== -1);
  assert.ok(
    quita[0].index > render && quita[0].index < rama,
    "la limpieza vive en renderDoc, antes del if de formato",
  );
});
