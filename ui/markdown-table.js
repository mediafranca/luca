// Manipulación de tablas Markdown rectangulares, reciclado directamente de Vera.
// Lee, escribe, transpone y convierte formatos tabulares respetando la sintaxis estándar de Markdown.

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER_CELL = /^:?-+:?$/;

/** Parte una fila sin confundir `\|`, usado dentro de una celda, con un borde. */
export function markdownTableCells(row) {
  if (!TABLE_ROW.test(row)) return null;
  const inner = row.trim().slice(1, -1);
  const cells = [];
  let current = "";
  let slashes = 0;
  for (const character of inner) {
    if (character === "|" && slashes % 2 === 0) {
      cells.push(current.trim());
      current = "";
      slashes = 0;
      continue;
    }
    current += character;
    slashes = character === "\\" ? slashes + 1 : 0;
  }
  cells.push(current.trim());
  return cells;
}

function alignmentOf(cell) {
  const clean = cell.replace(/\s/g, "");
  if (!TABLE_DIVIDER_CELL.test(clean)) return null;
  if (clean.startsWith(":") && clean.endsWith(":")) return "center";
  if (clean.endsWith(":")) return "right";
  return "left";
}

/** Reconoce si un bloque de texto es una tabla Markdown rectangular portable. */
export function readMarkdownTable(source) {
  const lines = source.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = markdownTableCells(lines[0] ?? "");
  const divider = markdownTableCells(lines[1] ?? "");
  if (header === null || divider === null || header.length === 0 || divider.length !== header.length) {
    return null;
  }
  const alignments = divider.map(alignmentOf);
  if (alignments.some((a) => a === null)) return null;

  const rows = [];
  for (const line of lines.slice(2)) {
    const row = markdownTableCells(line);
    if (row === null || row.length !== header.length) return null;
    rows.push(row);
  }
  return { header, alignments, rows };
}

function safeCell(source) {
  let escaped = "";
  let slashes = 0;
  for (const character of String(source ?? "").trim().replace(/[\r\n]+/g, " ")) {
    if (character === "|" && slashes % 2 === 0) escaped += "\\";
    escaped += character;
    slashes = character === "\\" ? slashes + 1 : 0;
  }
  return escaped;
}

function dividerFor(alignment) {
  if (alignment === "center") return ":---:";
  if (alignment === "right") return "---:";
  return "---";
}

/** Serializa la tabla a sintaxis Markdown limpia y alineada. */
export function writeMarkdownTable(table) {
  const columns = Math.max(1, table.header.length);
  const fit = (row) => Array.from({ length: columns }, (_, index) => safeCell(row[index] ?? ""));
  const header = fit(table.header);
  const alignments = Array.from({ length: columns }, (_, index) => table.alignments[index] ?? "left");
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${alignments.map(dividerFor).join(" | ")} |`,
    ...table.rows.map((row) => `| ${fit(row).join(" | ")} |`),
  ];
  return lines.join("\n");
}

/** Determina si la cabecera está en la primera fila o en la primera columna (eje lateral). */
export function tableHeaderAxis(table) {
  return table.header.every((cell) => cell.trim() === "") ? "column" : "row";
}

/** Crea una nueva estructura de tabla Markdown con dimensiones visibles. */
export function newMarkdownTable(rows = 3, columns = 3, axis = "row") {
  const height = Math.max(2, Math.min(25, Math.round(rows)));
  const width = Math.max(2, Math.min(20, Math.round(columns)));
  if (axis === "column") {
    return {
      header: Array.from({ length: width }, () => ""),
      alignments: Array.from({ length: width }, () => "left"),
      rows: Array.from({ length: height }, (_, row) =>
        Array.from({ length: width }, (_, column) => (column === 0 ? `Fila ${row + 1}` : ""))
      ),
    };
  }
  return {
    header: Array.from({ length: width }, (_, column) => `Columna ${column + 1}`),
    alignments: Array.from({ length: width }, () => "left"),
    rows: Array.from({ length: height - 1 }, () => Array.from({ length: width }, () => "")),
  };
}

export function newMarkdownTableSource(rows = 3, columns = 3, axis = "row") {
  return writeMarkdownTable(newMarkdownTable(rows, columns, axis));
}

/** Clona la tabla para evitar mutar el original antes de guardar. */
export function cloneTable(table) {
  return {
    header: [...table.header],
    alignments: [...table.alignments],
    rows: table.rows.map((row) => [...row]),
  };
}

/** Cambia el eje de cabecera entre fila y columna transponiendo datos. */
export function changeTableHeaderAxis(table, axis) {
  const current = tableHeaderAxis(table);
  if (current === axis) return cloneTable(table);
  const matrix = current === "row" ? [table.header, ...table.rows] : table.rows;
  const height = matrix.length;
  const width = Math.max(1, ...matrix.map((row) => row.length));
  const transposed = Array.from({ length: width }, (_, col) =>
    Array.from({ length: height }, (_, row) => matrix[row]?.[col] ?? "")
  );
  if (axis === "column") {
    return {
      header: Array.from({ length: height }, () => ""),
      alignments: Array.from({ length: height }, () => "left"),
      rows: transposed,
    };
  }
  return {
    header: transposed[0] ?? [""],
    alignments: Array.from({ length: height }, () => "left"),
    rows: transposed.slice(1),
  };
}

/** Detecta y parsea datos tabulares copiados desde Excel o Google Sheets (TSV). */
export function tabularClipboard(text) {
  const clean = text.replace(/\r/g, "").replace(/\n$/, "");
  if (!clean.includes("\t") && !clean.includes("\n")) return null;
  return clean.split("\n").map((row) => row.split("\t"));
}
