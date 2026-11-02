import test from "node:test";
import assert from "node:assert/strict";
import { Marked } from "marked";
import { footnoteExtension, insertFootnote, insertWikiRef, nextFootnoteLabel } from "../ui/footnotes.js";

const apply = (text, r) => text.slice(0, r.from) + r.insert + text.slice(r.to);

test("insertar una nota pone la llamada en el cursor y la definición al final", () => {
  const text = "Un párrafo.\n\nOtro párrafo.\n";
  const r = insertFootnote(text, "Un párrafo".length);
  const out = apply(text, r);
  assert.equal(out, "Un párrafo[^1].\n\nOtro párrafo.\n\n[^1]: \n");
  assert.equal(out.slice(r.cursor - 6, r.cursor), "[^1]: ");
});

test("una nota nueva se pega a las notas que ya están al final y toma el siguiente número", () => {
  const text = "A[^1] y B[^3].\n\n[^1]: uno\n[^3]: tres";
  const r = insertFootnote(text, 1);
  assert.equal(r.label, "4");
  assert.equal(apply(text, r), "A[^4][^1] y B[^3].\n\n[^1]: uno\n[^3]: tres\n[^4]: ");
});

test("las etiquetas con nombre no cuentan para la numeración y no se reescriben", () => {
  assert.equal(nextFootnoteLabel("x[^fuente]\n\n[^fuente]: y"), "1");
});

test("en Wikitext la nota es un <ref> en el sitio, con el cursor dentro", () => {
  const r = insertWikiRef(4);
  assert.deepEqual(r, { from: 4, to: 4, insert: "<ref></ref>", cursor: 9 });
});

function render(src) {
  const fn = footnoteExtension({ backLabel: () => "Volver" });
  const marked = new Marked({ extensions: fn.extensions });
  fn.reset(src);
  // Como renderBlocks: un token cada vez, con el estado compartido.
  return marked.lexer(src).map((tok) => marked.parser([tok])).join("");
}

test("la vista previa numera por orden de llamada y enlaza ida y vuelta", () => {
  const html = render("Primero[^b], luego[^a] y otra vez[^b].\n\n[^a]: Nota A\n[^b]: Nota *B*\n");
  assert.match(html, /<sup class="footnote-ref"><a href="#fn-b" id="fnref-b">1<\/a><\/sup>/);
  assert.match(html, /<a href="#fn-a" id="fnref-a">2<\/a>/);
  // La segunda llamada a la misma nota no repite el id.
  assert.match(html, /<a href="#fn-b">1<\/a>/);
  assert.match(html, /<div class="footnote" id="fn-b"><span class="footnote-num">1<\/span> <span class="footnote-text">Nota <em>B<\/em><\/span> <a class="footnote-back" href="#fnref-b" aria-label="Volver">↩<\/a><\/div>/);
});

test("una llamada sin definición queda como texto", () => {
  const html = render("Suelta[^x].\n");
  assert.match(html, /Suelta\[\^x\]\./);
  assert.doesNotMatch(html, /footnote-ref/);
});

test("una definición sin llamada se muestra con su etiqueta y sin vuelta", () => {
  const html = render("Texto.\n\n[^huerfana]: Sola\n");
  assert.match(html, /<span class="footnote-num">huerfana<\/span>/);
  assert.doesNotMatch(html, /footnote-back/);
});

test("una definición puede seguir en líneas sangradas", () => {
  const html = render("A[^1]\n\n[^1]: Primera línea\n    y continuación.\n");
  assert.match(html, /Primera línea y continuación\./);
});
