// luca — Markdown + Mermaid, offline primero (vendor/), CDN de respaldo.
// Patrón tomado de MarkChart: importar ESM, registrar motores de layout y
// diagramas externos, y renderizar cada bloque con mermaid.render (que valida).

import { createMarkdownEditor } from "./vendor/codemirror/editor.js";

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

const editorEl = document.getElementById("editor");
const preview = document.getElementById("preview");
let seq = 0; // ids únicos por render (mermaid inyecta <style id=...>)
let ed; // editor CodeMirror, creado al final con el doc inicial
let suppress = false; // true mientras cargamos un doc (no marcar sucio)
let t; // timer del debounce de render

async function render() {
  preview.innerHTML = marked.parse(ed.getDoc());
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

// ---- Archivos (solo dentro de Tauri; en navegador el editor es efímero) ----
// El texto se guarda tal cual lo escribió el usuario: Vera lleva las identidades
// en su manifiesto lateral, luca no inyecta nada en el Markdown.
const TAURI = window.__TAURI__;
let currentPath = null;
let dirty = false;
let lastMtime = null; // mtime observado del archivo vinculado (cambios externos)

const baseName = (p) => (p ? p.split(/[\\/]/).pop() : "sin título");
async function setTitle() {
  try { await TAURI?.window.getCurrentWindow().setTitle(`${baseName(currentPath)}${dirty ? " •" : ""} — luca`); } catch {}
}
function markDirty() { if (!dirty) { dirty = true; setTitle(); } }

function setDoc(text) { suppress = true; ed.setDoc(text); suppress = false; }

async function loadPath(path) {
  setDoc(await TAURI.core.invoke("read_file", { path }));
  currentPath = path; dirty = false;
  lastMtime = await TAURI.core.invoke("stat", { path });
  render(); setTitle();
}
async function openFile() {
  const path = await TAURI.dialog.open({ filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }] });
  if (typeof path === "string") await loadPath(path);
}
async function saveFile(forceDialog = false) {
  let path = currentPath;
  const isNew = forceDialog || !path;
  if (isNew) {
    path = await TAURI.dialog.save({
      defaultPath: currentPath ?? "sin título.md",
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (!path) return;
  } else {
    // ¿cambió fuera de luca (p.ej. Vera) desde que lo leímos? No pisar en silencio.
    const cur = await TAURI.core.invoke("stat", { path });
    if (cur !== null && lastMtime !== null && cur !== lastMtime &&
        !confirm("El archivo cambió fuera de luca. ¿Sobrescribir?")) return;
  }
  lastMtime = await TAURI.core.invoke("write_file", { path, contents: ed.getDoc() });
  currentPath = path; dirty = false; setTitle();
}
function newFile() {
  if (dirty && !confirm("Hay cambios sin guardar. ¿Descartar?")) return;
  setDoc(""); currentPath = null; dirty = false; render(); setTitle();
}

// CodeMirror avisa cada cambio del doc. ponytail: 150ms debounce; un render
// viejo que siga corriendo escribe sobre bloques que el innerHTML nuevo ya
// reemplazó, lo cual es inocuo para este MVP.
function onEdit() {
  if (suppress) return;
  markDirty();
  clearTimeout(t);
  t = setTimeout(render, 150);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  ed.setDark(dark); initMermaid(); render();
});

if (TAURI) {
  addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "o") { e.preventDefault(); openFile(); }
    else if (k === "s") { e.preventDefault(); saveFile(e.shiftKey); }
    else if (k === "n") { e.preventDefault(); newFile(); }
  });
  TAURI.event.listen("open-file", (e) => loadPath(e.payload)); // apertura en caliente
}

const SAMPLE = `# luca

Editor Markdown mínimo y rápido, con **Mermaid offline** (mermaid 12 + ELK, tidy-tree y ZenUML).

\`\`\`mermaid
flowchart LR
  escribir --> ver --> pensar --> escribir
\`\`\`
`;

// Apertura en frío: si Vera/Finder lanzaron luca con un archivo, cárgalo.
const pending = TAURI ? await TAURI.core.invoke("take_opened_file") : null;
const initialDoc = pending ? await TAURI.core.invoke("read_file", { path: pending }) : SAMPLE;
if (pending) { currentPath = pending; lastMtime = await TAURI.core.invoke("stat", { path: pending }); }

ed = createMarkdownEditor({
  parent: editorEl,
  doc: initialDoc,
  dark: matchMedia("(prefers-color-scheme: dark)").matches,
  onChange: onEdit,
});
render();
setTitle();
ed.focus();
