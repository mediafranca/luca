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
  mermaid.initialize({
    startOnLoad: false,
    theme: dark() ? "dark" : "default",
    securityLevel: "loose",
    maxTextSize: 10_000_000,
    maxEdges: 2000,
  });
}

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

// ---------- Multi-documento ----------
// Cada documento tiene su propio editor y su propio preview; una apertura nueva
// NO cierra ni reemplaza a los demás (contrato con Vera). El texto se guarda tal
// cual: Vera lleva las identidades en su manifiesto lateral, luca no inyecta nada.
const tabsEl = document.getElementById("tabs");
const editorsEl = document.getElementById("editors");
const previewsEl = document.getElementById("previews");
const TAURI = window.__TAURI__;

const docs = [];     // documentos abiertos
let active = null;   // documento activo
let seq = 0;         // ids de mermaid, únicos entre TODOS los documentos
let nextId = 1;

const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;
const baseName = (p) => (p ? p.split(/[\\/]/).pop() : "sin título");

async function setTitle() {
  const name = active ? `${baseName(active.path)}${active.dirty ? " •" : ""}` : "luca";
  try { await TAURI?.window.getCurrentWindow().setTitle(`${name} — luca`); } catch {}
}

async function renderDoc(doc) {
  doc.previewEl.innerHTML = marked.parse(doc.ed.getDoc());
  for (const block of doc.previewEl.querySelectorAll("pre.mermaid")) {
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

// ponytail: 150ms debounce por documento. Un render viejo que siga corriendo
// escribe sobre bloques que el innerHTML nuevo ya reemplazó; inocuo para el MVP.
function onEdit(doc) {
  if (!doc.dirty) { doc.dirty = true; renderTabs(); if (doc === active) setTitle(); }
  clearTimeout(doc.t);
  doc.t = setTimeout(() => renderDoc(doc), 150);
}

function renderTabs() {
  tabsEl.replaceChildren(...docs.map((doc) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (doc === active ? " active" : "");
    tab.title = doc.path ?? "sin guardar";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = (doc.dirty ? "• " : "") + baseName(doc.path);
    const close = document.createElement("button");
    close.className = "close";
    close.textContent = "×";
    close.title = "Cerrar";
    close.addEventListener("click", (e) => { e.stopPropagation(); closeDoc(doc); });
    tab.append(label, close);
    tab.addEventListener("mousedown", () => activate(doc));
    return tab;
  }));
}

function activate(doc) {
  active = doc;
  for (const d of docs) { d.editorEl.hidden = d !== doc; d.previewEl.hidden = d !== doc; }
  renderTabs();
  setTitle();
  doc.ed.focus();
}

function makeDoc(initialDoc, path) {
  const editorEl = document.createElement("div");
  editorEl.className = "doc-editor";
  const previewEl = document.createElement("div");
  previewEl.className = "doc-preview";
  editorsEl.append(editorEl);
  previewsEl.append(previewEl);
  const doc = { id: nextId++, path: path ?? null, dirty: false, lastMtime: null, editorEl, previewEl, ed: null, t: null };
  doc.ed = createMarkdownEditor({ parent: editorEl, doc: initialDoc, dark: dark(), onChange: () => onEdit(doc) });
  docs.push(doc);
  activate(doc);
  renderDoc(doc);
  return doc;
}

const findByPath = (path) => docs.find((d) => d.path && d.path === path);

async function openPath(path) {
  const existing = findByPath(path);        // contrato: reabrir reutiliza, no duplica
  if (existing) { activate(existing); return existing; }
  const content = await TAURI.core.invoke("read_file", { path });
  const doc = makeDoc(content, path);
  doc.lastMtime = await TAURI.core.invoke("stat", { path });
  return doc;
}

async function openFile() {
  const path = await TAURI.dialog.open({ filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }] });
  if (typeof path === "string") await openPath(path);
}

async function saveDoc(doc, forceDialog = false) {
  let path = doc.path;
  const isNew = forceDialog || !path;
  if (isNew) {
    path = await TAURI.dialog.save({ defaultPath: doc.path ?? "sin título.md", filters: [{ name: "Markdown", extensions: ["md", "markdown"] }] });
    if (!path) return;
  } else {
    // ¿cambió fuera de luca (p.ej. Vera) desde que lo leímos? No pisar en silencio.
    const cur = await TAURI.core.invoke("stat", { path });
    if (cur !== null && doc.lastMtime !== null && cur !== doc.lastMtime &&
        !confirm("El archivo cambió fuera de luca. ¿Sobrescribir?")) return;
  }
  doc.lastMtime = await TAURI.core.invoke("write_file", { path, contents: doc.ed.getDoc() });
  doc.path = path; doc.dirty = false;
  renderTabs(); if (doc === active) setTitle();
}

const newDoc = () => makeDoc("", null);

function closeDoc(doc) {
  if (doc.dirty && !confirm(`"${baseName(doc.path)}" tiene cambios sin guardar. ¿Cerrar igual?`)) return;
  const i = docs.indexOf(doc);
  doc.editorEl.remove();
  doc.previewEl.remove();
  docs.splice(i, 1);
  if (docs.length === 0) { newDoc(); return; }   // siempre al menos un documento
  if (active === doc) activate(docs[Math.min(i, docs.length - 1)]);
  else renderTabs();
}

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  initMermaid();
  for (const d of docs) { d.ed.setDark(dark()); renderDoc(d); }
});

addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey)) return;
  const k = e.key.toLowerCase();
  if (k === "n") { e.preventDefault(); newDoc(); }
  else if (k === "w") { e.preventDefault(); if (active) closeDoc(active); }
  else if (!TAURI) return; // abrir/guardar sólo dentro de la app
  else if (k === "o") { e.preventDefault(); openFile(); }
  else if (k === "s") { e.preventDefault(); if (active) saveDoc(active, e.shiftKey); }
});

if (TAURI) {
  TAURI.event.listen("open-file", (e) => openPath(e.payload)); // apertura en caliente: añade pestaña
}

const SAMPLE = `# luca

Editor Markdown mínimo y rápido, con **Mermaid offline** (mermaid 12 + ELK, tidy-tree y ZenUML).

\`\`\`mermaid
flowchart LR
  escribir --> ver --> pensar --> escribir
\`\`\`
`;

initMermaid();

// Arranque: si Vera/Finder lanzaron luca con un archivo, ábrelo; si no, el ejemplo.
const pending = TAURI ? await TAURI.core.invoke("take_opened_file") : null;
if (pending) await openPath(pending);
else makeDoc(SAMPLE, null);
