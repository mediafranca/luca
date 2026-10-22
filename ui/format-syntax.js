// Sintaxis de marcado según el formato del documento (Markdown o Wikitext).
// Módulo puro, sin DOM: la barra de herramientas y el editor de tablas lo usan
// para emitir el marcado correcto del documento activo, y se prueba en Node.

export function normalizeFormat(format) {
  return format === "wikitext" ? "wikitext" : "markdown";
}

const INLINE = {
  markdown: {
    bold: ["**", "**"],
    italic: ["*", "*"],
    strikethrough: ["~~", "~~"],
    underline: ["++", "++"],
    superscript: ["^", "^"],
    subscript: ["~", "~"],
    code: ["`", "`"],
  },
  wikitext: {
    bold: ["'''", "'''"],
    italic: ["''", "''"],
    strikethrough: ["<s>", "</s>"],
    underline: ["<u>", "</u>"],
    superscript: ["<sup>", "</sup>"],
    subscript: ["<sub>", "</sub>"],
    code: ["<code>", "</code>"],
  },
};

const LINE_PREFIX = {
  markdown: { bullet: "- ", numbered: "1. ", task: "- [ ] ", quote: "> " },
  // La cita en Wikitext no es un prefijo de línea sino un envoltorio (ver abajo);
  // la lista de tareas no tiene equivalente.
  wikitext: { bullet: "* ", numbered: "# ", task: null, quote: null },
};

const PREFIX_STRIP = {
  markdown: /^(\s*[-*+]\s*|\s*\d+\.\s*|\s*>\s*|\s*-\s*\[[ xX]\]\s*)/,
  wikitext: /^(\s*[*#:;]+\s*)/,
};

const BLOCKQUOTE = ["<blockquote>", "</blockquote>"];

/** Par [apertura, cierre] del marcado en línea `kind` para el formato dado. */
export function inlineMarkers(format, kind) {
  const markers = INLINE[normalizeFormat(format)][kind];
  if (!markers) throw new Error(`Marcado en línea desconocido: ${kind}`);
  return markers;
}

/** Marcador de encabezado para mostrarlo en ayudas: `##` o `==`. */
export function headingMarker(format, level) {
  const n = Math.min(6, Math.max(1, level));
  return normalizeFormat(format) === "wikitext" ? "=".repeat(n) : "#".repeat(n);
}

/**
 * Alterna un par de marcadores alrededor de [start, end) dentro de `text`.
 * Devuelve el buffer completo con la selección resultante (para campos de
 * texto) y, además, el rango mínimo a reemplazar con su inserción (para el
 * editor). Si la selección ya está envuelta, por dentro o por fuera, la
 * desenvuelve.
 */
export function toggleInline(text, start, end, open, close = open) {
  const selected = text.slice(start, end);
  const ol = open.length;
  const cl = close.length;
  if (start >= ol && text.slice(start - ol, start) === open && text.slice(end, end + cl) === close) {
    return {
      buffer: text.slice(0, start - ol) + selected + text.slice(end + cl),
      selectionStart: start - ol,
      selectionEnd: end - ol,
      from: start - ol,
      to: end + cl,
      insert: selected,
    };
  }
  if (selected.length >= ol + cl && selected.startsWith(open) && selected.endsWith(close)) {
    const inner = selected.slice(ol, selected.length - cl);
    return {
      buffer: text.slice(0, start) + inner + text.slice(end),
      selectionStart: start,
      selectionEnd: start + inner.length,
      from: start,
      to: end,
      insert: inner,
    };
  }
  return {
    buffer: text.slice(0, start) + open + selected + close + text.slice(end),
    selectionStart: start + ol,
    selectionEnd: end + ol,
    from: start,
    to: end,
    insert: open + selected + close,
  };
}

/** Convierte una línea en encabezado de nivel `level` (0 = párrafo normal). */
export function headingLine(format, level, lineText) {
  if (normalizeFormat(format) === "wikitext") {
    const stripped = lineText.replace(/^\s*=+\s*/, "").replace(/\s*=+\s*$/, "");
    if (level <= 0) return stripped;
    const marker = headingMarker("wikitext", level);
    return `${marker} ${stripped} ${marker}`;
  }
  const stripped = lineText.replace(/^#{1,6}\s+/, "");
  return level > 0 ? `${headingMarker("markdown", level)} ${stripped}` : stripped;
}

/** Indica si el formato ofrece la acción (la lista de tareas no existe en Wikitext). */
export function supportsLineAction(format, kind) {
  const f = normalizeFormat(format);
  if (kind === "quote") return true;
  return Boolean(LINE_PREFIX[f][kind]);
}

/** Alterna el prefijo de lista o cita de una línea según el formato. */
export function toggledLine(format, kind, lineText) {
  const f = normalizeFormat(format);
  if (f === "wikitext" && kind === "quote") {
    const [open, close] = BLOCKQUOTE;
    const trimmed = lineText.trim();
    if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
      return trimmed.slice(open.length, trimmed.length - close.length).trim();
    }
    return `${open}${trimmed}${close}`;
  }
  const prefix = LINE_PREFIX[f][kind];
  if (!prefix) return lineText;
  if (lineText.startsWith(prefix)) return lineText.slice(prefix.length);
  return `${prefix}${lineText.replace(PREFIX_STRIP[f], "")}`;
}

/** Bloque de código con `text` dentro; selección relativa al inicio de la inserción. */
export function codeBlock(format, text = "") {
  const [open, close] = normalizeFormat(format) === "wikitext" ? ["<pre>\n", "\n</pre>\n"] : ["```\n", "\n```\n"];
  return {
    insert: `${open}${text}${close}`,
    selectionStart: open.length,
    selectionEnd: open.length + text.length,
  };
}

/** Enlace externo o interno; selección relativa al inicio de la inserción. */
export function linkSnippet(format, kind, text = "") {
  if (kind === "internal") {
    return { insert: `[[${text}]]`, selectionStart: 2, selectionEnd: 2 + text.length };
  }
  const label = text || "texto";
  if (normalizeFormat(format) === "wikitext") {
    const insert = `[https:// ${label}]`;
    return text
      ? { insert, selectionStart: 1, selectionEnd: 9 }
      : { insert, selectionStart: 10, selectionEnd: 10 + label.length };
  }
  const insert = `[${label}](https://)`;
  return text
    ? { insert, selectionStart: label.length + 3, selectionEnd: label.length + 11 }
    : { insert, selectionStart: 1, selectionEnd: 1 + label.length };
}

/** Nombre legible del formato para títulos de interfaz. */
export function formatLabel(format) {
  return normalizeFormat(format) === "wikitext" ? "Wikitext" : "Markdown";
}
