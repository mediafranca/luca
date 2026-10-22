import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isWikitextTableClose, isWikitextTableOpen, readWikitextTable, writeWikitextTable } from "../ui/wikitext-table.js";
import { newMarkdownTable } from "../ui/markdown-table.js";

const fixture = readFileSync(new URL("./fixtures/wikitext-complejo.wiki", import.meta.url), "utf8");

test("lee la tabla del fixture sin romper enlaces con | dentro de [[ ]]", () => {
  const block = fixture.slice(fixture.indexOf("{|"));
  const table = readWikitextTable(block);
  assert.deepEqual(table.header, ["Columna", "Otra"]);
  assert.deepEqual(table.rows, [["[[Página interna|texto]]", "[https://example.org enlace]"]]);
  assert.deepEqual(table.alignments, ["left", "left"]);
});

test("escribe y vuelve a leer una tabla con alineación, leyenda y celdas en varias líneas", () => {
  const table = {
    header: ["A", "B"],
    alignments: ["left", "center"],
    rows: [["uno", "dos"], ["tres\ncuatro", "cinco"]],
    caption: "Leyenda",
  };
  const source = writeWikitextTable(table);
  assert.equal(
    source,
    [
      '{| class="wikitable"',
      "|+ Leyenda",
      '! A !! style="text-align:center"| B',
      "|-",
      '| uno || style="text-align:center"| dos',
      "|-",
      "| tres\ncuatro",
      '| style="text-align:center"| cinco',
      "|}",
    ].join("\n")
  );
  const again = readWikitextTable(source);
  assert.deepEqual(again.header, table.header);
  assert.deepEqual(again.alignments, table.alignments);
  assert.deepEqual(again.rows, table.rows);
  assert.equal(again.caption, "Leyenda");
});

test("escapa los separadores de celda dentro del contenido", () => {
  const source = writeWikitextTable({ header: ["a || b"], alignments: ["left"], rows: [["c !! d"]] });
  assert.equal(source, '{| class="wikitable"\n! a &#124;&#124; b\n|-\n| c &#33;&#33; d\n|}');
  assert.deepEqual(readWikitextTable(source).rows, [["c &#33;&#33; d"]]);
});

test("una tabla sin fila de cabecera usa cabecera lateral y conserva las celdas", () => {
  const table = readWikitextTable("{|\n|-\n! Fila 1\n| x\n|-\n! Fila 2\n| y\n|}");
  assert.deepEqual(table.header, ["", ""]);
  assert.deepEqual(table.rows, [["Fila 1", "x"], ["Fila 2", "y"]]);
  assert.equal(table.rowHeaders, true);
  assert.equal(writeWikitextTable(table), '{| class="wikitable"\n|-\n! Fila 1\n| x\n|-\n! Fila 2\n| y\n|}');
});

test("rechaza bloques que no son tablas simples y reconoce los delimitadores", () => {
  assert.equal(readWikitextTable("texto"), null);
  assert.equal(readWikitextTable("{|\n| a\n"), null);
  assert.equal(readWikitextTable("{|\n| a\n{|\n| anidada\n|}\n|}"), null);
  assert.equal(isWikitextTableOpen('  {| class="wikitable"'), true);
  assert.equal(isWikitextTableClose("|}"), true);
  assert.equal(isWikitextTableClose("| }"), false);
});

test("una tabla nueva del editor se serializa como wikitable con cabecera", () => {
  const source = writeWikitextTable(newMarkdownTable(2, 2, "row"));
  assert.equal(source, '{| class="wikitable"\n! Columna 1 !! Columna 2\n|-\n|  || \n|}');
  assert.deepEqual(readWikitextTable(source).header, ["Columna 1", "Columna 2"]);
});
