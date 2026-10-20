const editor = document.getElementById("editor");
const preview = document.getElementById("preview");

mermaid.initialize({
  startOnLoad: false,
  theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
});

marked.use({
  renderer: {
    code(code, lang) {
      return lang === "mermaid"
        ? '<pre class="mermaid">' + code + "</pre>"
        : "<pre><code>" + code.replace(/</g, "&lt;") + "</code></pre>";
    },
  },
});

function render() {
  preview.innerHTML = marked.parse(editor.value);
  const blocks = preview.querySelectorAll("pre.mermaid");
  if (blocks.length) {
    blocks.forEach((b) => b.removeAttribute("data-processed"));
    mermaid.run({ nodes: blocks });
  }
}

// ponytail: 120ms debounce; drop it if render ever feels laggy on big docs.
let t;
editor.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(render, 120);
});

editor.value = `# luca

Editor Markdown mínimo y rápido.

- escribe a la izquierda
- mira a la derecha

\`\`\`mermaid
flowchart LR
  escribir --> ver --> pensar --> escribir
\`\`\`
`;
render();
