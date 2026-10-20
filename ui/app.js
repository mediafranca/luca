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

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const mermaidTheme = () => { try { return localStorage.getItem("luca.mermaidTheme") || "vera"; } catch { return "vera"; } };

// Mermaid: por defecto "vera" = tema 'base' tokenizado a los colores de Vera,
// así el diagrama hereda la paleta de la app (claro/oscuro). El usuario puede
// elegir otro preset desde Preferencias.
function initMermaid() {
  const base = { startOnLoad: false, securityLevel: "loose", maxTextSize: 10_000_000, maxEdges: 2000 };
  const choice = mermaidTheme();
  if (choice === "vera") {
    mermaid.initialize({
      ...base,
      theme: "base",
      themeVariables: {
        darkMode: dark(),
        background: cssVar("--bg"),
        mainBkg: cssVar("--bg-raised"),
        primaryColor: cssVar("--bg-raised"),
        primaryTextColor: cssVar("--text"),
        primaryBorderColor: cssVar("--rule"),
        secondaryColor: cssVar("--bg"),
        tertiaryColor: cssVar("--bg"),
        nodeBorder: cssVar("--rule"),
        clusterBkg: cssVar("--bg"),
        clusterBorder: cssVar("--rule"),
        lineColor: cssVar("--text-dim"),
        textColor: cssVar("--text"),
        titleColor: cssVar("--text"),
        edgeLabelBackground: cssVar("--bg"),
        fontFamily: "var(--font-body)",
        fontSize: "14px",
      },
    });
  } else {
    mermaid.initialize({ ...base, theme: choice });
  }
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
  const name = active ? `${baseName(active.path)}${active.dirty ? " •" : ""}` : "Luca";
  try { await TAURI?.window.getCurrentWindow().setTitle(`${name} — Luca`); } catch {}
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

// Atajos por teclado SOLO fuera de Tauri (en la app los maneja el menú nativo).
if (!TAURI) {
  addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "n") { e.preventDefault(); newDoc(); }
    else if (k === "w") { e.preventDefault(); if (active) closeDoc(active); }
    else if (e.shiftKey && k === "z") { e.preventDefault(); toggleZen(); }
    else if (e.key === "1") { e.preventDefault(); applyMode("source"); }
    else if (e.key === "2") { e.preventDefault(); applyMode("split"); }
    else if (e.key === "3") { e.preventDefault(); applyMode("rendered"); }
  });
}

if (TAURI) {
  TAURI.event.listen("open-file", (e) => openPath(e.payload)); // apertura en caliente: añade pestaña
  TAURI.event.listen("menu", (e) => {
    const id = e.payload, a = active;
    if (id === "new") newDoc();
    else if (id === "open") openFile();
    else if (id === "save") { if (a) saveDoc(a, false); }
    else if (id === "save_as") { if (a) saveDoc(a, true); }
    else if (id === "close_tab") { if (a) closeDoc(a); }
    else if (id === "export_pdf") exportPdf();
    else if (id === "prefs_mermaid") openPrefs();
    else if (id === "mode_source") applyMode("source");
    else if (id === "mode_split") applyMode("split");
    else if (id === "mode_rendered") applyMode("rendered");
    else if (id === "zen") toggleZen();
  });
}

// ---------- Modos de vista (source · split · rendered) y zen ----------
function applyMode(m) {
  document.body.dataset.mode = m;
  for (const b of document.querySelectorAll("#modebar button[data-mode]"))
    b.classList.toggle("active", b.dataset.mode === m);
  try { localStorage.setItem("luca.mode", m); } catch {}
}
function toggleZen(force) {
  const on = force ?? document.body.dataset.zen !== "on";
  document.body.dataset.zen = on ? "on" : "off";
  try { localStorage.setItem("luca.zen", on ? "on" : "off"); } catch {}
}
for (const b of document.querySelectorAll("#modebar button[data-mode]"))
  b.addEventListener("click", () => applyMode(b.dataset.mode));
document.getElementById("zen").addEventListener("click", () => toggleZen());

// Exportar a PDF: @media print en index.html deja sólo la vista previa activa;
// el diálogo de impresión de macOS ofrece «Guardar como PDF».
function exportPdf() { window.print(); }

// ---------- Editor de tokens (Preferencias) ----------
// Todos los tokens son administrables: se guardan como override en localStorage
// y se aplican en línea sobre :root. Un override de color pisa ambos esquemas.
const FONT_STACKS = [
  ["IBM Plex Mono", "'IBM Plex Mono', ui-monospace, Menlo, monospace"],
  ["IBM Plex Sans", "'IBM Plex Sans', system-ui, sans-serif"],
  ["Roboto Serif", "'Roboto Serif', Georgia, serif"],
  ["Mono del sistema", "ui-monospace, 'SF Mono', Menlo, monospace"],
  ["Serif del sistema", "Georgia, 'Times New Roman', serif"],
  ["Sans del sistema", "system-ui, sans-serif"],
];
const TOKENS = [
  { group: "Tipografía" },
  { name: "--font-mono", label: "Código", kind: "font" },
  { name: "--font-read", label: "Texto renderizado", kind: "font" },
  { group: "Medida" },
  { name: "--text-size", label: "Tamaño de texto", kind: "text" },
  { name: "--line-height", label: "Interlínea", kind: "text" },
  { name: "--content-width", label: "Ancho de columna", kind: "text" },
  { group: "Color" },
  { name: "--bg", label: "Fondo", kind: "color" },
  { name: "--bg-raised", label: "Fondo elevado", kind: "color" },
  { name: "--text", label: "Texto", kind: "color" },
  { name: "--text-dim", label: "Texto tenue", kind: "color" },
  { name: "--rule", label: "Líneas", kind: "color" },
  { name: "--accent", label: "Acento", kind: "color" },
];

const loadOverrides = () => { try { return JSON.parse(localStorage.getItem("luca.tokens") || "{}"); } catch { return {}; } };
function saveOverride(name, val) { const o = loadOverrides(); o[name] = val; try { localStorage.setItem("luca.tokens", JSON.stringify(o)); } catch {} }
function applyOverrides() { for (const [n, v] of Object.entries(loadOverrides())) document.documentElement.style.setProperty(n, v); }
const tokenValue = (name) => (loadOverrides()[name] ?? cssVar(name)).trim();

const prefsEl = document.getElementById("prefs");
const mermaidSel = document.getElementById("mermaidTheme");
const tokenForm = document.getElementById("tokenForm");

function onTokenChange(name, val, kind) {
  document.documentElement.style.setProperty(name, val);
  saveOverride(name, val);
  for (const d of docs) d.ed.remeasure?.();           // fuente/tamaño nuevos: re-medir
  if (kind !== "color") for (const d of docs) renderDoc(d);
}

function buildTokenForm() {
  if (!tokenForm) return;
  tokenForm.replaceChildren();
  for (const t of TOKENS) {
    if (t.group) {
      const g = document.createElement("div"); g.className = "prefs-group"; g.textContent = t.group;
      tokenForm.append(g); continue;
    }
    const row = document.createElement("div"); row.className = "prefs-row";
    const span = document.createElement("span"); span.textContent = t.label; row.append(span);
    let input;
    if (t.kind === "font") {
      input = document.createElement("select");
      for (const [label, stack] of FONT_STACKS) {
        const o = document.createElement("option"); o.value = stack; o.textContent = label; input.append(o);
      }
      input.value = tokenValue(t.name);
      input.addEventListener("change", () => onTokenChange(t.name, input.value, "font"));
    } else if (t.kind === "color") {
      input = document.createElement("input"); input.type = "color";
      const v = tokenValue(t.name);
      input.value = /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
      input.addEventListener("input", () => onTokenChange(t.name, input.value, "color"));
    } else {
      input = document.createElement("input"); input.type = "text";
      input.value = tokenValue(t.name);
      input.addEventListener("change", () => onTokenChange(t.name, input.value, "text"));
    }
    row.append(input); tokenForm.append(row);
  }
}

function openPrefs() { if (mermaidSel) mermaidSel.value = mermaidTheme(); buildTokenForm(); if (prefsEl) prefsEl.hidden = false; }
function closePrefs() { if (prefsEl) prefsEl.hidden = true; }
function resetTokens() {
  try { localStorage.removeItem("luca.tokens"); } catch {}
  for (const t of TOKENS) if (t.name) document.documentElement.style.removeProperty(t.name);
  buildTokenForm();
  for (const d of docs) { d.ed.remeasure?.(); renderDoc(d); }
}

if (prefsEl) {
  prefsEl.addEventListener("click", (e) => { if (e.target === prefsEl) closePrefs(); });
  document.getElementById("prefsClose").addEventListener("click", closePrefs);
  document.getElementById("prefsReset").addEventListener("click", resetTokens);
  mermaidSel.addEventListener("change", () => {
    try { localStorage.setItem("luca.mermaidTheme", mermaidSel.value); } catch {}
    initMermaid();
    for (const d of docs) renderDoc(d);
  });
}
// ⌘, abre Preferencias (convención macOS; también en el navegador).
addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === ",") { e.preventDefault(); openPrefs(); }
});
applyOverrides();
buildTokenForm();

// Esc sale del zen SIEMPRE: en fase de captura, antes de que CodeMirror lo tome.
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.dataset.zen === "on") {
    e.preventDefault(); e.stopPropagation();
    toggleZen(false);
  }
}, true);

// Estado inicial, recordado por visor (localStorage es una comodidad local).
let mode0 = "split", zen0 = "off";
try { mode0 = localStorage.getItem("luca.mode") || "split"; zen0 = localStorage.getItem("luca.zen") || "off"; } catch {}
applyMode(mode0);
document.body.dataset.zen = zen0;

const SAMPLE = `# Luca

Editor Markdown mínimo y rápido, con **Mermaid offline** (mermaid 12 + ELK, tidy-tree y ZenUML).

\`\`\`mermaid
flowchart LR
  escribir --> ver --> pensar --> escribir
\`\`\`
`;

initMermaid();

// Esperar a que las fuentes carguen ANTES de montar el editor, para que
// CodeMirror mida las líneas con Plex Mono y no queden desalineadas.
if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }

// Arranque: si Vera/Finder lanzaron Luca con un archivo, ábrelo; si no, el ejemplo.
const pending = TAURI ? await TAURI.core.invoke("take_opened_file") : null;
if (pending) await openPath(pending);
else makeDoc(SAMPLE, null);
