import test from "node:test";
import assert from "node:assert/strict";
import { detectedLineEnding, documentHeadings } from "../ui/document-outline.js";

test("extrae encabezados Markdown con posición", () => {
  assert.deepEqual(documentHeadings("# Uno\ntexto\n## Dos", "markdown"), [
    { level: 1, label: "Uno", offset: 0 },
    { level: 2, label: "Dos", offset: 12 },
  ]);
});

test("extrae encabezados Wikitext", () => {
  assert.deepEqual(documentHeadings("== Uno ==\n=== Dos ===", "wikitext").map((h) => [h.level, h.label]), [[2, "Uno"], [3, "Dos"]]);
});

test("detecta el fin de línea original", () => {
  assert.equal(detectedLineEnding("a\r\nb"), "CRLF");
  assert.equal(detectedLineEnding("a\nb"), "LF");
});
