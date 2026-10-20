// Edición por bloques sobre la vista renderizada (specs/edicion-renderizada.allium).
// El bloque señalado se sustituye in situ por un editor mínimo con su Markdown
// fuente y la tipografía del bloque renderizado. Cada cambio reemplaza SOLO el
// rango del bloque en el documento (la única fuente de verdad); al salir, la
// vista se vuelve a renderizar desde el texto.
import { createMarkdownEditor } from "./vendor/codemirror/editor.js";

// ponytail: heurística de cursor — busca en la fuente el texto que precede al
// punto señalado (24 y luego 8 caracteres); si no aparece, va al final.
function caretFor(el, point, source) {
  const r = point && document.caretRangeFromPoint?.(point.x, point.y);
  if (!r || !el.contains(r.startContainer)) return source.length;
  const rng = document.createRange();
  rng.setStart(el, 0);
  rng.setEnd(r.startContainer, r.startOffset);
  const pre = rng.toString();
  if (!pre.trim()) return 0;
  for (const n of [24, 8]) {
    const s = pre.slice(-n);
    const i = s ? source.indexOf(s) : -1;
    if (i >= 0) return i + s.length;
  }
  return source.length;
}

export function beginBlockEdit(doc, el, point, { dark, onExit }) {
  exitBlockEdit(doc);
  const from = Number(el.dataset.from);
  const source = doc.ed.getDoc().slice(from, Number(el.dataset.to));
  const caret = caretFor(el, point, source);

  const host = document.createElement("div");
  host.className = `block-edit ${el.tagName.toLowerCase()}`;
  (el.closest(".preview-table-wrapper") ?? el).replaceWith(host);

  const block = { from, to: from + source.length, host, ed: null, onExit };
  block.ed = createMarkdownEditor({
    parent: host,
    doc: source,
    dark,
    block: true,
    onChange: (text) => {
      doc.ed.setRange(text, block.from, block.to);
      block.to = block.from + text.length;
    },
  });
  doc.block = block;

  host.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); exitBlockEdit(doc); }
  }, true);
  // Salir al perder el foco, salvo hacia la barra de herramientas o sus menús
  // (operan sobre este bloque) o el editor de tablas.
  host.addEventListener("focusout", () => setTimeout(() => {
    if (doc.block !== block) return;
    const a = document.activeElement;
    if (host.contains(a) || a?.closest?.(".editor-toolbar, .toolbar-heading-menu, .table-modal")) return;
    exitBlockEdit(doc);
  }));

  block.ed.setSelection(caret);
}

export function exitBlockEdit(doc, render = true) {
  const block = doc.block;
  if (!block) return;
  doc.block = null;
  block.ed.destroy();
  if (render) block.onExit();
}
