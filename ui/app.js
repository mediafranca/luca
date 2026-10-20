// luca — Markdown + Mermaid, offline primero (vendor/), CDN de respaldo.
// Patrón tomado de MarkChart: importar ESM, registrar motores de layout y
// diagramas externos, y renderizar cada bloque con mermaid.render (que valida).

const LOCAL = "./vendor";
const CDN = "https://cdn.jsdelivr.net/npm";

// Carga un módulo local; si falla (p.ej. vendor ausente), cae al CDN.
async function load(localPath, cdnPath) {
  try {
    return await import(`${LOCAL}/${localPath}`);
  } catch (e) {
    console.warn(`luca: ${localPath} no disponible offline, usando CDN`, e);
    return await import(`${CDN}/${cdnPath}`);
  }
}

const [{ marked }, mermaidMod, elkMod, tidyMod, zenumlMod] = await Promise.all([
  load("marked/marked.esm.js", "marked@12/lib/marked.esm.js"),
  load("mermaid/mermaid.esm.min.mjs", "mermaid@12/dist/mermaid.esm.min.mjs"),
  load("layout-elk/mermaid-layout-elk.esm.min.mjs", "@mermaid-js/layout-elk@1/dist/mermaid-layout-elk.esm.min.mjs"),
  load("tidy-tree/mermaid-layout-tidy-tree.esm.min.mjs", "@mermaid-js/layout-tidy-tree@1/dist/mermaid-layout-tidy-tree.esm.mjs"),
  load("zenuml/mermaid-zenuml.esm.min.mjs", "@mermaid-js/mermaid-zenuml@1/dist/mermaid-zenuml.esm.min.mjs"),
]);

const mermaid = mermaidMod.default;
await mermaid.registerLayoutLoaders(elkMod.default);
await mermaid.registerLayoutLoaders(tidyMod.default);
await mermaid.registerExternalDiagrams([zenumlMod.default]);

function initMermaid() {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "default",
    securityLevel: "loose",
    maxTextSize: 10_000_000,
    maxEdges: 2000,
  });
}
initMermaid();

// marked: los fences ```mermaid salen como <pre class="mermaid"> con el código crudo.
marked.use({
  renderer: {
    code(code, lang) {
      return lang === "mermaid"
        ? `<pre class="mermaid">${code}</pre>`
        : `<pre><code>${code.replace(/</g, "&lt;")}</code></pre>`;
    },
  },
});

const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
let seq = 0; // ids únicos por render (mermaid inyecta <style id=...>)

async function render() {
  preview.innerHTML = marked.parse(editor.value);
  for (const block of preview.querySelectorAll("pre.mermaid")) {
    const def = block.textContent;
    try {
      const { svg, bindFunctions } = await mermaid.render(`luca-d${seq++}`, def);
      block.innerHTML = svg;
      bindFunctions?.(block);
    } catch (err) {
      block.className = "mermaid-error";
      block.textContent = `⚠ Mermaid: ${err?.message ?? err}`;
    }
  }
}

// ponytail: 150ms debounce. Un render viejo que siga corriendo escribe sobre
// bloques que el innerHTML nuevo ya reemplazó; es inocuo para este MVP.
let t;
editor.addEventListener("input", () => { clearTimeout(t); t = setTimeout(render, 150); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { initMermaid(); render(); });

editor.value = `# luca

Editor Markdown mínimo y rápido, con **Mermaid offline** (mermaid 12 + ELK, tidy-tree y ZenUML).

\`\`\`mermaid
flowchart LR
  escribir --> ver --> pensar --> escribir
\`\`\`

\`\`\`mermaid
sequenceDiagram
  Luca->>Vera: publicar texto
  Vera-->>Luca: ok
\`\`\`
`;
render();
