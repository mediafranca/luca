// Fuente del editor CodeMirror 6. NO se carga directo en el navegador (usa
// imports "bare"): esbuild la empaqueta a ui/vendor/codemirror/editor.js desde
// scripts/vendor.mjs. Expone una API mínima para app.js.
//
// Los colores y tipografías salen de los tokens de Vera (variables CSS en
// :root), así que el claro/oscuro cambia solo con el sistema.
import { EditorView, basicSetup } from "codemirror";
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

const themeFor = (dark) => [editorTheme(dark), syntaxHighlighting(highlight)];

export function createMarkdownEditor({ parent, doc, dark, onChange }) {
  const themeComp = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        markdown({ base: markdownLanguage }),
        EditorView.lineWrapping,
        themeComp.of(themeFor(dark)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
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
    setDark: (d) => view.dispatch({ effects: themeComp.reconfigure(themeFor(d)) }),
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
    getLineAt: (pos) => view.state.doc.lineAt(pos),
  };
}
