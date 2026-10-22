import test from "node:test";
import assert from "node:assert/strict";
import {
  codeBlock,
  headingLine,
  inlineMarkers,
  linkSnippet,
  supportsLineAction,
  toggleInline,
  toggledLine,
} from "../ui/format-syntax.js";

test("el marcado en línea sigue al formato del documento", () => {
  assert.deepEqual(inlineMarkers("markdown", "bold"), ["**", "**"]);
  assert.deepEqual(inlineMarkers("wikitext", "bold"), ["'''", "'''"]);
  assert.deepEqual(inlineMarkers("wikitext", "italic"), ["''", "''"]);
  assert.deepEqual(inlineMarkers("wikitext", "code"), ["<code>", "</code>"]);
  assert.deepEqual(inlineMarkers("desconocido", "italic"), ["*", "*"]);
});

test("toggleInline envuelve y desenvuelve con marcadores asimétricos", () => {
  const [open, close] = inlineMarkers("wikitext", "strikethrough");
  const wrapped = toggleInline("ver texto aquí", 4, 9, open, close);
  assert.equal(wrapped.buffer, "ver <s>texto</s> aquí");
  assert.equal(wrapped.insert, "<s>texto</s>");
  assert.deepEqual([wrapped.from, wrapped.to], [4, 9]);
  assert.equal(wrapped.buffer.slice(wrapped.selectionStart, wrapped.selectionEnd), "texto");

  const outer = toggleInline(wrapped.buffer, wrapped.selectionStart, wrapped.selectionEnd, open, close);
  assert.equal(outer.buffer, "ver texto aquí");
  const inner = toggleInline("ver <s>texto</s> aquí", 4, 16, open, close);
  assert.equal(inner.buffer, "ver texto aquí");
  assert.equal(inner.buffer.slice(inner.selectionStart, inner.selectionEnd), "texto");
});

test("los encabezados usan # en Markdown y = en Wikitext", () => {
  assert.equal(headingLine("markdown", 2, "Título"), "## Título");
  assert.equal(headingLine("markdown", 1, "### Título"), "# Título");
  assert.equal(headingLine("markdown", 0, "## Título"), "Título");
  assert.equal(headingLine("wikitext", 2, "Título"), "== Título ==");
  assert.equal(headingLine("wikitext", 3, "== Título =="), "=== Título ===");
  assert.equal(headingLine("wikitext", 0, "== Título =="), "Título");
});

test("las listas y citas cambian de prefijo según el formato", () => {
  assert.equal(toggledLine("markdown", "bullet", "1. uno"), "- uno");
  assert.equal(toggledLine("markdown", "bullet", "- uno"), "uno");
  assert.equal(toggledLine("wikitext", "bullet", "# uno"), "* uno");
  assert.equal(toggledLine("wikitext", "numbered", "* uno"), "# uno");
  assert.equal(toggledLine("wikitext", "quote", "frase"), "<blockquote>frase</blockquote>");
  assert.equal(toggledLine("wikitext", "quote", "<blockquote>frase</blockquote>"), "frase");
  assert.equal(supportsLineAction("markdown", "task"), true);
  assert.equal(supportsLineAction("wikitext", "task"), false);
  assert.equal(toggledLine("wikitext", "task", "tarea"), "tarea");
});

test("bloques de código y enlaces según el formato", () => {
  assert.equal(codeBlock("markdown", "x").insert, "```\nx\n```\n");
  assert.equal(codeBlock("wikitext", "x").insert, "<pre>\nx\n</pre>\n");
  const md = linkSnippet("markdown", "external", "Vera");
  assert.equal(md.insert, "[Vera](https://)");
  assert.equal(md.insert.slice(md.selectionStart, md.selectionEnd), "https://");
  const wiki = linkSnippet("wikitext", "external", "Vera");
  assert.equal(wiki.insert, "[https:// Vera]");
  assert.equal(wiki.insert.slice(wiki.selectionStart, wiki.selectionEnd), "https://");
  const empty = linkSnippet("wikitext", "external", "");
  assert.equal(empty.insert.slice(empty.selectionStart, empty.selectionEnd), "texto");
  assert.equal(linkSnippet("wikitext", "internal", "Página").insert, "[[Página]]");
});
