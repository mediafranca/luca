import test from "node:test";
import assert from "node:assert/strict";

import { externalWebUrl, isEditablePreviewMode, isInternalAnchor } from "../ui/preview-behavior.js";

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
