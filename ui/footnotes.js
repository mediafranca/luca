// Notas al pie: `texto[^1]` llama a una nota definida con `[^1]: aclaración`.
// Luca nunca renumera ni mueve las notas del archivo; la numeración correlativa
// existe sólo en la vista previa, en el orden en que aparecen las llamadas.

const DEF_LINE = /^ {0,3}\[\^([^\]\s]+)\]:/;
const DEF_LINES = /^ {0,3}\[\^([^\]\s]+)\]:/gm;
const LABELS = /\[\^([^\]\s]+)\]/g;

// ponytail: escaneo por líneas; una definición dentro de un bloque de código
// cuenta igual. Basta para decidir qué llamadas se enlazan.
export function definedFootnotes(text) {
  return new Set([...text.matchAll(DEF_LINES)].map((m) => m[1]));
}

// Siguiente número libre, por encima de cualquier etiqueta numérica usada.
export function nextFootnoteLabel(text) {
  let max = 0;
  for (const [, label] of text.matchAll(LABELS)) {
    if (/^\d+$/.test(label)) max = Math.max(max, Number(label));
  }
  return String(max + 1);
}

// Markdown: la llamada va en `at` y la definición al final del documento, tras
// una línea en blanco (o pegada a la nota anterior). Devuelve un solo reemplazo
// desde `at` hasta el final, para que deshacer lo revierta de una vez, y la
// posición del cursor, lista para escribir la aclaración.
export function insertFootnote(text, at) {
  const label = nextFootnoteLabel(text);
  const withRef = `${text.slice(0, at)}[^${label}]${text.slice(at)}`;
  const trailing = withRef.match(/\n*$/)[0];
  const body = withRef.slice(0, withRef.length - trailing.length);
  const lastLine = body.slice(body.lastIndexOf("\n") + 1);
  const sep = body === "" ? "" : DEF_LINE.test(lastLine) ? "\n" : "\n\n";
  const def = `[^${label}]: `;
  const full = `${body}${sep}${def}${trailing ? "\n" : ""}`;
  return {
    label,
    from: at,
    to: text.length,
    insert: full.slice(at),
    cursor: body.length + sep.length + def.length,
  };
}

// Wikitext: la nota vive en su sitio, `<ref>…</ref>`; la wiki la numera y la
// lleva al pie (Cite añade la lista aunque falte <references />).
export function insertWikiRef(at) {
  return { from: at, to: at, insert: "<ref></ref>", cursor: at + "<ref>".length };
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Extensión de marked. Luca renderiza bloque a bloque, así que el estado vive
// fuera: `reset(text)` antes de cada documento. Las definiciones se renderizan
// donde están —al final, por convención— y siguen siendo bloques editables.
export function footnoteExtension({ backLabel = () => "↩" } = {}) {
  let defined = new Set();
  let numbers = new Map();
  let seen = new Set();
  const numberFor = (label) => {
    if (!numbers.has(label)) numbers.set(label, numbers.size + 1);
    return numbers.get(label);
  };
  return {
    reset(text) {
      defined = definedFootnotes(text);
      numbers = new Map();
      seen = new Set();
    },
    extensions: [
      {
        name: "footnoteDef",
        level: "block",
        start: (src) => src.match(/^ {0,3}\[\^[^\]\s]+\]:/m)?.index,
        tokenizer(src) {
          const m = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*([^\n]*(?:\n(?: {2,}|\t)[^\n]*)*)(?:\n|$)/.exec(src);
          if (!m) return undefined;
          const text = m[2].split("\n").map((line) => line.trim()).join(" ");
          return { type: "footnoteDef", raw: m[0], label: m[1], tokens: this.lexer.inlineTokens(text) };
        },
        renderer(token) {
          const label = escapeHtml(token.label);
          const number = numbers.get(token.label);
          const back = number
            ? ` <a class="footnote-back" href="#fnref-${label}" aria-label="${escapeHtml(backLabel())}">↩</a>`
            : "";
          return `<div class="footnote" id="fn-${label}"><span class="footnote-num">${number ?? label}</span> `
            + `<span class="footnote-text">${this.parser.parseInline(token.tokens)}</span>${back}</div>\n`;
        },
      },
      {
        name: "footnoteRef",
        level: "inline",
        start: (src) => { const i = src.indexOf("[^"); return i < 0 ? undefined : i; },
        tokenizer(src) {
          const m = /^\[\^([^\]\s]+)\](?!:)/.exec(src);
          if (!m || !defined.has(m[1])) return undefined;   // sin definición: texto literal
          return { type: "footnoteRef", raw: m[0], label: m[1] };
        },
        renderer(token) {
          const label = escapeHtml(token.label);
          const first = !seen.has(token.label);
          seen.add(token.label);
          const id = first ? ` id="fnref-${label}"` : "";
          return `<sup class="footnote-ref"><a href="#fn-${label}"${id}>${numberFor(token.label)}</a></sup>`;
        },
      },
    ],
  };
}
