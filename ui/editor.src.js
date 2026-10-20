// Fuente del editor CodeMirror 6. NO se carga directo en el navegador (usa
// imports "bare"): esbuild la empaqueta a ui/vendor/codemirror/editor.js desde
// scripts/vendor.mjs. Expone una API mínima para app.js.
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

// Tema claro: transparente para heredar el fondo de la ventana.
const lightTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", height: "100%" },
  ".cm-scroller": { fontFamily: "ui-monospace, Menlo, monospace", lineHeight: "1.6" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
});

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
        lightTheme,
        themeComp.of(dark ? oneDark : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
        }),
      ],
    }),
  });
  return {
    getDoc: () => view.state.doc.toString(),
    setDoc: (text) =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    setDark: (d) => view.dispatch({ effects: themeComp.reconfigure(d ? oneDark : []) }),
    focus: () => view.focus(),
  };
}
