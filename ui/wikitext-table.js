// Tablas Wikitext (`{| … |}`) con el mismo modelo { header, alignments, rows }
// que markdown-table.js, para que el editor visual sirva a ambos formatos.
// Cubre la sintaxis habitual: cabeceras con `!`/`!!`, filas con `|-`, celdas
// con `|`/`||`, atributos de celda (`style="text-align:center"|`), leyenda `|+`
// y celdas en varias líneas. Tablas anidadas no se reconocen (devuelve null).

import { tableHeaderAxis } from "./markdown-table.js";

const OPEN = /^\s*\{\|/;
const CLOSE = /^\s*\|\}\s*$/;

export function isWikitextTableOpen(line) {
  return OPEN.test(line);
}

export function isWikitextTableClose(line) {
  return CLOSE.test(line);
}

function alignmentOf(attributes) {
  const match = /text-align\s*:\s*(left|center|right)/i.exec(attributes);
  return match ? match[1].toLowerCase() : null;
}

/** Separa `atributos | contenido` sin confundirse con `[[Página|texto]]` o plantillas. */
function parseCell(raw) {
  const pipe = raw.indexOf("|");
  if (pipe > 0) {
    const before = raw.slice(0, pipe);
    if (/=/.test(before) && !/[[\]{}]/.test(before)) {
      return { text: raw.slice(pipe + 1).trim(), align: alignmentOf(before) };
    }
  }
  return { text: raw.trim(), align: null };
}

/** Reconoce una tabla Wikitext; devuelve null si el bloque no es una tabla simple. */
export function readWikitextTable(source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex((line) => OPEN.test(line));
  if (first < 0) return null;
  let last = -1;
  for (let i = lines.length - 1; i > first; i--) {
    if (CLOSE.test(lines[i])) { last = i; break; }
  }
  if (last < 0) return null;

  const rows = [];
  let current = null;
  let caption = null;
  const flush = () => {
    if (current && current.length) rows.push(current);
    current = null;
  };
  for (const line of lines.slice(first + 1, last)) {
    const text = line.trim();
    if (!text) continue;
    if (OPEN.test(text)) return null;
    if (text.startsWith("|-")) { flush(); current = []; continue; }
    if (text.startsWith("|+")) { caption = text.slice(2).trim(); continue; }
    if (text.startsWith("!") || text.startsWith("|")) {
      if (!current) current = [];
      const header = text.startsWith("!");
      const parts = header ? text.slice(1).split(/(?:!!|\|\|)/) : text.slice(1).split("||");
      for (const part of parts) current.push({ ...parseCell(part), header });
      continue;
    }
    if (current && current.length) {
      const cell = current[current.length - 1];
      cell.text = `${cell.text}\n${text}`;
      continue;
    }
    return null;
  }
  flush();
  if (!rows.length) return null;

  const width = Math.max(...rows.map((row) => row.length));
  const fit = (row) => Array.from({ length: width }, (_, i) => row[i]?.text ?? "");
  const alignmentsFrom = (candidates) =>
    Array.from({ length: width }, (_, i) => candidates.map((row) => row[i]?.align).find(Boolean) ?? "left");

  if (rows[0].every((cell) => cell.header)) {
    const body = rows.slice(1);
    return {
      header: fit(rows[0]),
      alignments: alignmentsFrom(body.length ? body : rows),
      rows: body.map(fit),
      caption,
      rowHeaders: false,
    };
  }
  // Sin fila de cabecera: el editor trabaja con cabecera lateral (primera columna).
  return {
    header: Array.from({ length: width }, () => ""),
    alignments: alignmentsFrom(rows),
    rows: rows.map(fit),
    caption,
    rowHeaders: rows.every((row) => row[0]?.header && row.slice(1).every((cell) => !cell.header)),
  };
}

function cellSource(table, index, text) {
  const alignment = table.alignments[index];
  const attributes = alignment && alignment !== "left" ? `style="text-align:${alignment}"| ` : "";
  // `||` y `!!` siempre separan celdas, incluso en una celda con línea propia.
  const safe = String(text ?? "").trim().replace(/\|\|/g, "&#124;&#124;").replace(/!!/g, "&#33;&#33;");
  return `${attributes}${safe}`;
}

/** Serializa la tabla a Wikitext con la clase `wikitable`. */
export function writeWikitextTable(table) {
  const columns = Math.max(1, table.header.length);
  const fit = (row) => Array.from({ length: columns }, (_, i) => cellSource(table, i, row[i]));
  const axis = tableHeaderAxis(table);
  const rowHeaders = axis === "column" && table.rowHeaders !== false;
  const lines = ['{| class="wikitable"'];
  if (table.caption) lines.push(`|+ ${table.caption}`);
  if (axis === "row") lines.push(`! ${fit(table.header).join(" !! ")}`);
  for (const row of table.rows) {
    lines.push("|-");
    const cells = fit(row);
    const compact = cells.every((cell) => !cell.includes("\n"));
    if (compact && !rowHeaders) {
      lines.push(`| ${cells.join(" || ")}`);
      continue;
    }
    cells.forEach((cell, i) => lines.push(`${rowHeaders && i === 0 ? "!" : "|"} ${cell}`));
  }
  lines.push("|}");
  return lines.join("\n");
}
