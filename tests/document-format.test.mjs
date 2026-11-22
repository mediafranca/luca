import test from "node:test";
import assert from "node:assert/strict";
import { extensionMismatch, inferredFormat, interpretedFormat } from "../ui/document-format.js";

test("infiere Markdown y Wikitext por extensión sin distinguir mayúsculas", () => {
  assert.equal(inferredFormat("/tmp/a.MD"), "markdown");
  assert.equal(inferredFormat("C:\\textos\\a.WIKITEXT"), "wikitext");
  assert.equal(inferredFormat("a.wiki"), "wikitext");
  assert.equal(inferredFormat("/tmp/notas.TXT"), "text");
  assert.equal(interpretedFormat("a.md", "text"), "text");
});

test("el override prevalece y automático vuelve a inferir", () => {
  assert.equal(interpretedFormat("a.wiki", "markdown"), "markdown");
  assert.equal(interpretedFormat("a.wiki", "auto"), "wikitext");
  assert.equal(interpretedFormat("sin-extension", "auto", "wikitext"), "wikitext");
});

test("avisa sólo ante una extensión conocida que contradice el override", () => {
  assert.equal(extensionMismatch("a.md", "wikitext"), true);
  assert.equal(extensionMismatch("a.wiki", "wikitext"), false);
  assert.equal(extensionMismatch("a.txt", "wikitext"), true);
  assert.equal(extensionMismatch("a.txt", "text"), false);
  assert.equal(extensionMismatch("sin-extension", "wikitext"), false);
  assert.equal(extensionMismatch("a.md", "auto"), false);
});
