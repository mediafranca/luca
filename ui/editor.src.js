// Fuente del editor CodeMirror 6. NO se carga directo en el navegador (usa
// imports "bare"): esbuild la empaqueta a ui/vendor/codemirror/editor.js desde
// scripts/vendor.mjs. Expone una API mínima para app.js.
//
// Los colores y tipografías salen de los tokens de Vera (variables CSS en
// :root), así que el claro/oscuro cambia solo con el sistema.
import { EditorView, basicSetup, minimalSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Interlínea FIJA en píxeles: cada línea mide lo mismo pase lo que pase con la
// carga de la fuente, así numeración y contenido no se desalinean.
const LH = "22px";
function editorTheme(dark) {
  return EditorView.theme(
    {
      "&": { color: "var(--code-text, var(--text))", backgroundColor: "var(--code-bg, var(--bg))", fontSize: "13.5px", lineHeight: LH },
      // CodeMirror fija font-family en .cm-scroller; hay que ponerla AQUÍ o la pisa.
      ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: LH },
      ".cm-content": { caretColor: "var(--accent)", padding: "20px 20px", lineHeight: LH },
      ".cm-line": { lineHeight: LH, padding: "0 2px" },
      ".cm-gutters": { backgroundColor: "var(--code-bg, var(--bg))", color: "var(--text-dim)", border: "none",
                       fontSize: "12px", lineHeight: LH },
      ".cm-lineNumbers .cm-gutterElement": { lineHeight: LH, padding: "0 10px 0 16px" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--code-text, var(--text))" },
    },
    { dark },
  );
}

const highlight = HighlightStyle.define([
  { tag: [t.heading, t.heading1, t.heading2, t.heading3], color: "var(--code-text, var(--text))", fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: [t.link, t.url], color: "var(--accent)" },
  { tag: [t.monospace, t.literal], color: "var(--text-dim)" },
  { tag: t.quote, color: "var(--text-dim)", fontStyle: "italic" },
  { tag: [t.list, t.processingInstruction], color: "var(--accent)" },
]);

// Editor de bloque (vista renderizada): sin numeración ni fondo propio; la
// tipografía la hereda del bloque renderizado que sustituye (CSS .block-edit).
const blockTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "inherit", fontSize: "inherit", lineHeight: "inherit" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit", overflow: "visible" },
  ".cm-content": { padding: "0", caretColor: "var(--accent)", lineHeight: "inherit" },
  ".cm-line": { padding: "0" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent)" },
});

// Resaltado del bloque: sin colores propios (hereda los de la vista previa);
// sólo énfasis, enlaces en acento y código en mono, como en el texto renderizado.
const blockHighlight = HighlightStyle.define([
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: [t.link, t.url], color: "var(--accent)" },
  { tag: [t.monospace, t.literal], fontFamily: "var(--font-mono)", fontSize: ".9em" },
]);

const themeFor = (dark, block) =>
  block ? [blockTheme, syntaxHighlighting(blockHighlight)] : [editorTheme(dark), syntaxHighlighting(highlight)];

export function createMarkdownEditor({ parent, doc, dark, onChange, onCursor, block = false }) {
  const themeComp = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        block ? minimalSetup : basicSetup,
        markdown({ base: markdownLanguage }),
        EditorView.lineWrapping,
        themeComp.of(themeFor(dark, block)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
          if (u.selectionSet || u.docChanged) onCursor?.();
        }),
      ],
    }),
  });
  // Recalcular medidas cuando Plex Mono termine de cargar: evita que la
  // numeración y el contenido queden desalineados por medir con otra fuente.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    document.fonts.ready.then(() => view.requestMeasure()).catch(() => {});
  }

  return {
    getDoc: () => view.state.doc.toString(),
    setDoc: (text) =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    setDark: (d) => view.dispatch({ effects: themeComp.reconfigure(themeFor(d, block)) }),
    destroy: () => view.destroy(),
    remeasure: () => view.requestMeasure(),
    focus: () => view.focus(),
    getView: () => view,
    getSelection: () => {
      const sel = view.state.selection.main;
      return {
        from: sel.from,
        to: sel.to,
        empty: sel.empty,
        text: view.state.sliceDoc(sel.from, sel.to),
      };
    },
    replaceSelection: (text) => {
      const sel = view.state.selection.main;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
        selection: { anchor: sel.from + text.length },
        userEvent: "input",
      });
      view.focus();
    },
    // Reemplazo sin tocar foco ni selección (lo usa la edición por bloques).
    setRange: (text, from, to) => view.dispatch({ changes: { from, to, insert: text } }),
    replaceRange: (text, from, to) => {
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        userEvent: "input",
      });
      view.focus();
    },
    setSelection: (anchor, head) => {
      view.dispatch({
        selection: { anchor, head: head ?? anchor },
        scrollIntoView: true,
      });
      view.focus();
    },
    getCursor: () => view.state.selection.main.head,
    getCursorLine: () => view.state.doc.lineAt(view.state.selection.main.head).number,
    getLineAt: (pos) => view.state.doc.lineAt(pos),
  };
}
