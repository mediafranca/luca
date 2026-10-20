// luca — Markdown + Mermaid, offline primero (vendor/), CDN de respaldo.
// Patrón tomado de MarkChart: importar ESM, registrar motores de layout y
// diagramas externos, y renderizar cada bloque con mermaid.render (que valida).

import { createMarkdownEditor } from "./vendor/codemirror/editor.js";
import { createEditorToolbar, editDocumentTableAtIndex } from "./toolbar.js";
import { icon } from "./icons.js";
import { beginBlockEdit, exitBlockEdit } from "./block-edit.js";

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
    const previewBg = cssVar("--preview-bg") || cssVar("--bg");
    const previewText = cssVar("--preview-text") || cssVar("--text");
    mermaid.initialize({
      ...base,
      theme: "base",
      themeVariables: {
        darkMode: dark(),
        background: previewBg,
        mainBkg: cssVar("--bg-raised"),
        primaryColor: cssVar("--bg-raised"),
        primaryTextColor: previewText,
        primaryBorderColor: cssVar("--rule"),
        secondaryColor: previewBg,
        tertiaryColor: previewBg,
        nodeBorder: cssVar("--rule"),
        clusterBkg: previewBg,
        clusterBorder: cssVar("--rule"),
        lineColor: cssVar("--text-dim"),
        textColor: previewText,
        titleColor: previewText,
        edgeLabelBackground: previewBg,
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

// Una sola barra de herramientas, en la barra superior; opera sobre el
// documento activo (el getter resuelve `doc.ed` en cada clic).
document.getElementById("modes").after(createEditorToolbar({ get ed() { return active?.block?.ed ?? active?.ed; } }));

const dark = () => isCurrentDark();
const baseName = (p) => (p ? p.split(/[\\/]/).pop() : "sin título");

async function setTitle() {
  const name = active ? `${baseName(active.path)}${active.dirty ? " •" : ""}` : "Luca";
  try { await TAURI?.window.getCurrentWindow().setTitle(`${name} — Luca`); } catch {}
}

function getDocDir(doc) {
  if (!doc?.path) return null;
  const p = doc.path;
  const lastSlash = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return lastSlash !== -1 ? p.slice(0, lastSlash) : null;
}

function resolveDocPath(baseDir, relPath) {
  if (!baseDir || !relPath) return relPath;
  const trimmed = relPath.trim();
  if (/^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  const cleanRel = trimmed.replace(/^\.\//, "");
  return `${baseDir}/${cleanRel}`;
}

function toAssetUrl(filePath) {
  if (!filePath) return filePath;
  if (/^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/i.test(filePath)) return filePath;
  if (TAURI?.core?.convertFileSrc) {
    try {
      return TAURI.core.convertFileSrc(filePath);
    } catch {
      return `asset://localhost${filePath.startsWith("/") ? "" : "/"}${encodeURI(filePath)}`;
    }
  }
  return filePath;
}

// Markdown → DOM por bloques: cada elemento de nivel superior lleva data-line
// con la línea del texto donde empieza su bloque (para sincronizar el scroll y,
// más adelante, para la edición por bloques).
function renderBlocks(src) {
  const text = src.replace(/\r\n|\r/g, "\n");
  const nl = (t) => (t.match(/\n/g) || []).length;
  const out = document.createElement("template");
  let pos = 0, line = 1;
  for (const tok of marked.lexer(text)) {
    // ponytail: marked omite los tokens `def`; indexOf recupera el hueco.
    let at = text.indexOf(tok.raw, pos);
    if (at < 0) at = pos;
    line += nl(text.slice(pos, at));
    if (tok.type !== "space") {
      const t = document.createElement("template");
      t.innerHTML = marked.parser([tok]);
      const src = tok.raw.replace(/\n+$/, "");   // sin las líneas en blanco que separan bloques
      for (const el of t.content.children) {
        el.dataset.line = line;
        el.dataset.from = at;
        el.dataset.to = at + src.length;
      }
      out.content.append(t.content);
    }
    line += nl(tok.raw);
    pos = at + tok.raw.length;
  }
  return out.content;
}

async function renderDoc(doc) {
  if (doc.block) return;   // hay un bloque en edición: se renderiza al salir
  doc.previewEl.replaceChildren(renderBlocks(doc.ed.getDoc()));

  // Resolver rutas relativas de imágenes y medios locales respecto al archivo abierto
  const docDir = getDocDir(doc);
  if (docDir) {
    const mediaEls = doc.previewEl.querySelectorAll("img, video, audio, source");
    for (const el of mediaEls) {
      const rawSrc = el.getAttribute("src");
      if (!rawSrc) continue;
      if (/^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/i.test(rawSrc.trim())) continue;
      const absPath = resolveDocPath(docDir, rawSrc);
      el.src = toAssetUrl(absPath);
    }
  }

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

  // Detectar tablas en la vista previa y agregar botón visual de edición (reciclado de Vera)
  const tables = [...doc.previewEl.querySelectorAll("table")];
  tables.forEach((table, tableIndex) => {
    if (table.parentElement?.classList.contains("preview-table-wrapper")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "preview-table-wrapper";
    table.replaceWith(wrapper);
    wrapper.append(table);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "preview-edit-table";
    editBtn.innerHTML = `${icon("grid")} Editar tabla`;
    editBtn.title = "Editar visualmente esta tabla";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editDocumentTableAtIndex(doc, tableIndex);
    });
    wrapper.append(editBtn);
  });
  syncPreview(doc);
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
  if (active && active !== doc) exitBlockEdit(active);
  active = doc;
  for (const d of docs) { d.editorEl.hidden = d !== doc; d.previewEl.hidden = d !== doc; }
  renderTabs();
  setTitle();
  doc.ed.focus();
}

function makeDoc(initialDoc, path) {
  const editorEl = document.createElement("div");
  editorEl.className = "doc-editor";
  const cmMount = document.createElement("div");
  cmMount.className = "doc-editor-cm";

  const previewEl = document.createElement("div");
  previewEl.className = "doc-preview";
  editorsEl.append(editorEl);
  previewsEl.append(previewEl);

  const doc = {
    id: nextId++,
    path: path ?? null,
    dirty: false,
    lastMtime: null,
    editorEl,
    cmMount,
    previewEl,
    ed: null,
    t: null,
    block: null,   // bloque en edición en la vista renderizada (block-edit.js)
  };

  doc.ed = createMarkdownEditor({
    parent: cmMount,
    doc: initialDoc,
    dark: isCurrentDark(),
    onChange: () => onEdit(doc),
    onCursor: () => syncPreview(doc),
  });
  editorEl.append(cmMount);

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
  exitBlockEdit(doc, false);
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

// Atajos por teclado globales (en fase de captura para responder aun con foco en CodeMirror)
addEventListener(
  "keydown",
  (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "n") { e.preventDefault(); newDoc(); }
    else if (k === "w") { e.preventDefault(); if (active) closeDoc(active); }
    else if (e.shiftKey && k === "z") { e.preventDefault(); toggleZen(); }
    else if (e.key === "1") { e.preventDefault(); applyMode("source"); }
    else if (e.key === "2") { e.preventDefault(); applyMode("split"); }
    else if (e.key === "3") { e.preventDefault(); applyMode("rendered"); }
    else if (e.key === ",") { e.preventDefault(); openPrefs(); }
  },
  true
);

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

// ---------- Vista dividida: proporción arrastrable y scroll a la par ----------
const workspaceEl = document.getElementById("workspace");
const dividerEl = document.getElementById("divider");
try { const s = localStorage.getItem("luca.split"); if (s) workspaceEl.style.setProperty("--split", s); } catch {}
dividerEl.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  dividerEl.setPointerCapture(e.pointerId);
  const rect = workspaceEl.getBoundingClientRect();
  const move = (ev) => {
    const pct = Math.min(80, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100));
    workspaceEl.style.setProperty("--split", `${pct.toFixed(1)}%`);
  };
  const up = () => {
    dividerEl.removeEventListener("pointermove", move);
    dividerEl.removeEventListener("pointerup", up);
    try { localStorage.setItem("luca.split", workspaceEl.style.getPropertyValue("--split")); } catch {}
    active?.ed.remeasure();
  };
  dividerEl.addEventListener("pointermove", move);
  dividerEl.addEventListener("pointerup", up);
});
dividerEl.addEventListener("dblclick", () => {
  workspaceEl.style.removeProperty("--split");
  try { localStorage.removeItem("luca.split"); } catch {}
});

// Lleva la vista previa al bloque donde está el cursor: sólo en split y para
// el documento activo. Los bloques llevan data-line (ver renderBlocks).
function syncPreview(doc) {
  if (doc !== active || document.body.dataset.mode !== "split") return;
  const line = doc.ed.getCursorLine();
  let target = null;
  for (const el of doc.previewEl.querySelectorAll("[data-line]")) {
    if (Number(el.dataset.line) > line) break;
    target = el;
  }
  if (!target) return;
  const pv = doc.previewEl;
  const top = pv.scrollTop + target.getBoundingClientRect().top - pv.getBoundingClientRect().top - 24;
  pv.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

// ---------- Modos de vista (source · split · rendered), tema y zen ----------
function applyMode(m) {
  document.body.dataset.mode = m;
  for (const b of document.querySelectorAll("#modebar button[data-mode]"))
    b.classList.toggle("active", b.dataset.mode === m);
  try { localStorage.setItem("luca.mode", m); } catch {}
  if (active && m !== "rendered") exitBlockEdit(active);
  if (active) syncPreview(active);
}

// Vista renderizada editable: pulsar un bloque lo abre con su Markdown in situ;
// pulsar fuera de un bloque cierra el que esté abierto.
previewsEl.addEventListener("click", (e) => {
  const doc = active;
  if (!doc || document.body.dataset.mode !== "rendered") return;
  if (e.target.closest(".block-edit, .preview-edit-table")) return;
  const el = e.target.closest("[data-from]");
  if (!el) { exitBlockEdit(doc); return; }
  e.preventDefault();   // un enlace no navega: se edita
  beginBlockEdit(doc, el, { x: e.clientX, y: e.clientY }, { dark: isCurrentDark(), onExit: () => renderDoc(doc) });
});

async function toggleZen(force) {
  const on = force ?? document.body.dataset.zen !== "on";
  document.body.dataset.zen = on ? "on" : "off";
  try { localStorage.setItem("luca.zen", on ? "on" : "off"); } catch {}

  const zenBtn = document.getElementById("zen");
  if (zenBtn) {
    zenBtn.classList.toggle("active", on);
    zenBtn.innerHTML = icon(on ? "minimize" : "maximize");
    zenBtn.title = on ? "Salir del modo zen · Esc o ⌘⇧Z" : "Modo zen (pantalla completa) · ⌘⇧Z";
  }

  if (TAURI?.window) {
    try {
      const win = TAURI.window.getCurrentWindow();
      if (on) {
        try { await win.maximize(); } catch {}
        try { await win.setFullscreen(true); } catch {}
      } else {
        try { await win.setFullscreen(false); } catch {}
        try { await win.unmaximize(); } catch {}
      }
    } catch (e) {
      console.warn("No se pudo alternar pantalla completa nativa:", e);
    }
  } else if (typeof document !== "undefined") {
    try {
      if (on && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else if (!on && document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch {}
  }
}

function updateThemeSwitchUI() {
  const isDark = isCurrentDark();
  const lightBtn = document.querySelector('[data-theme-btn="light"]');
  const darkBtn = document.querySelector('[data-theme-btn="dark"]');
  if (lightBtn) lightBtn.classList.toggle("active", !isDark);
  if (darkBtn) darkBtn.classList.toggle("active", isDark);
}

function initTopbarButtons() {
  const modeSource = document.querySelector('#modes button[data-mode="source"]');
  if (modeSource) modeSource.innerHTML = icon("code");
  const modeSplit = document.querySelector('#modes button[data-mode="split"]');
  if (modeSplit) modeSplit.innerHTML = icon("columns-2");
  const modeRendered = document.querySelector('#modes button[data-mode="rendered"]');
  if (modeRendered) modeRendered.innerHTML = icon("eye");

  const lightBtn = document.querySelector('[data-theme-btn="light"]');
  if (lightBtn) {
    lightBtn.innerHTML = icon("sun");
    lightBtn.addEventListener("click", () => {
      tokensState.scheme = "light";
      saveTokens();
      applyTokens();
      buildTokenForms();
    });
  }

  const darkBtn = document.querySelector('[data-theme-btn="dark"]');
  if (darkBtn) {
    darkBtn.innerHTML = icon("moon");
    darkBtn.addEventListener("click", () => {
      tokensState.scheme = "dark";
      saveTokens();
      applyTokens();
      buildTokenForms();
    });
  }

  const zenBtn = document.getElementById("zen");
  if (zenBtn) {
    zenBtn.innerHTML = icon(document.body.dataset.zen === "on" ? "minimize" : "maximize");
    zenBtn.addEventListener("click", () => toggleZen());
  }

  const prefsBtn = document.getElementById("prefsBtn");
  if (prefsBtn) {
    prefsBtn.innerHTML = icon("settings");
    prefsBtn.addEventListener("click", () => openPrefs());
  }

  for (const b of document.querySelectorAll("#modebar button[data-mode]")) {
    b.addEventListener("click", () => applyMode(b.dataset.mode));
  }
}

// Exportar a PDF: @media print en index.html deja sólo la vista previa activa;
// el diálogo de impresión de macOS ofrece «Guardar como PDF».
function exportPdf() { window.print(); }

// ---------- Sistema de Diseño y Tokens (Vera) ----------
// Las tipografías, medidas y anchos son generales.
// Los colores son por tema (Claro y Oscuro), ambos configurables y soportados.

export const VERA_DEFAULTS = {
  general: {
    "--font-mono": "'IBM Plex Mono', ui-monospace, Menlo, monospace",
    "--font-read": "'Roboto Serif', Georgia, serif",
    "--font-body": "'IBM Plex Sans', system-ui, sans-serif",
    "--font-ui": "system-ui, sans-serif",
    "--text-size": "16px",
    "--line-height": "1.55",
    "--content-width": "45em",
  },
  light: {
    "--bg": "#e6ebe9",
    "--bg-raised": "#e8ebf1",
    "--text": "#454f6e",
    "--text-dim": "#6b7080",
    "--code-bg": "#f4f6f8",
    "--code-text": "#1e293b",
    "--preview-bg": "#e6ebe9",
    "--preview-text": "#454f6e",
    "--rule": "#d1d1d2",
    "--accent": "#a84a0b",
    "--warm": "#e6706a",
    "--link-in": "#045591",
    "--link-out": "#a84a0b",
  },
  dark: {
    "--bg": "#2e0024",
    "--bg-raised": "#351725",
    "--text": "#cde0cf",
    "--text-dim": "#a4a696",
    "--code-bg": "#1e0018",
    "--code-text": "#f1f5f9",
    "--preview-bg": "#2e0024",
    "--preview-text": "#cde0cf",
    "--rule": "#24001c",
    "--accent": "#ee895d",
    "--warm": "#ec9d98",
    "--link-in": "#6fa8d0",
    "--link-out": "#ee895d",
  },
};

const FONT_STACKS = [
  ["IBM Plex Mono", "'IBM Plex Mono', ui-monospace, Menlo, monospace"],
  ["IBM Plex Sans", "'IBM Plex Sans', system-ui, sans-serif"],
  ["Roboto Serif", "'Roboto Serif', Georgia, serif"],
  ["Mono del sistema", "ui-monospace, 'SF Mono', Menlo, monospace"],
  ["Serif del sistema", "Georgia, 'Times New Roman', serif"],
  ["Sans del sistema", "system-ui, sans-serif"],
];

const GENERAL_TOKENS_META = [
  { group: "Tipografía" },
  { name: "--font-mono", label: "Código / Editor", kind: "font" },
  { name: "--font-read", label: "Texto de lectura (Vista previa)", kind: "font" },
  { name: "--font-body", label: "Cuerpo general", kind: "font" },
  { name: "--font-ui", label: "Interfaz", kind: "font" },
  { group: "Medida" },
  { name: "--text-size", label: "Tamaño de texto", kind: "text" },
  { name: "--line-height", label: "Interlínea", kind: "text" },
  { name: "--content-width", label: "Ancho de columna", kind: "text" },
];

const COLOR_TOKENS_META = [
  { group: "Entorno general" },
  { name: "--bg", label: "Fondo de aplicación" },
  { name: "--bg-raised", label: "Fondo barras / paneles" },
  { name: "--text", label: "Texto de aplicación" },
  { name: "--text-dim", label: "Texto tenue / metadatos" },
  { name: "--rule", label: "Líneas divisorias y bordes" },
  { name: "--accent", label: "Color de acento" },

  { group: "Editor de código (Code)" },
  { name: "--code-bg", label: "Fondo del editor de código" },
  { name: "--code-text", label: "Texto del editor de código" },

  { group: "Vista previa / Lectura (Preview)" },
  { name: "--preview-bg", label: "Fondo de vista previa" },
  { name: "--preview-text", label: "Texto de vista previa" },

  { group: "Enlaces y énfasis" },
  { name: "--warm", label: "Énfasis cálido" },
  { name: "--link-in", label: "Enlace entrante" },
  { name: "--link-out", label: "Enlace saliente" },
];

function loadTokens() {
  const held = localStorage.getItem("luca.tokens");
  if (!held) {
    return {
      general: { ...VERA_DEFAULTS.general },
      light: { ...VERA_DEFAULTS.light },
      dark: { ...VERA_DEFAULTS.dark },
      scheme: localStorage.getItem("luca.scheme") || "system",
    };
  }
  try {
    const parsed = JSON.parse(held);
    if (!parsed.general && !parsed.light && !parsed.dark) {
      // Compatibilidad con versiones previas planas
      const general = { ...VERA_DEFAULTS.general };
      const light = { ...VERA_DEFAULTS.light };
      const dark = { ...VERA_DEFAULTS.dark };
      for (const [k, v] of Object.entries(parsed)) {
        if (k in general) general[k] = v;
        if (k in light) light[k] = v;
        if (k in dark) dark[k] = v;
      }
      return { general, light, dark, scheme: localStorage.getItem("luca.scheme") || "system" };
    }
    return {
      general: { ...VERA_DEFAULTS.general, ...(parsed.general || {}) },
      light: { ...VERA_DEFAULTS.light, ...(parsed.light || {}) },
      dark: { ...VERA_DEFAULTS.dark, ...(parsed.dark || {}) },
      scheme: parsed.scheme || localStorage.getItem("luca.scheme") || "system",
    };
  } catch {
    return {
      general: { ...VERA_DEFAULTS.general },
      light: { ...VERA_DEFAULTS.light },
      dark: { ...VERA_DEFAULTS.dark },
      scheme: "system",
    };
  }
}

let tokensState = loadTokens();

function isCurrentDark() {
  if (tokensState.scheme === "dark") return true;
  if (tokensState.scheme === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function saveTokens() {
  try {
    localStorage.setItem("luca.tokens", JSON.stringify(tokensState));
    localStorage.setItem("luca.scheme", tokensState.scheme);
  } catch {}
}

function applyTokens() {
  let styleEl = document.getElementById("luca-tokens");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "luca-tokens";
    document.head.append(styleEl);
  }

  const genCSS = Object.entries(tokensState.general).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  const lightCSS = Object.entries(tokensState.light).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  const darkCSS = Object.entries(tokensState.dark).map(([k, v]) => `  ${k}: ${v};`).join("\n");

  styleEl.textContent = `
:root {
${genCSS}
${lightCSS}
}

@media (prefers-color-scheme: dark) {
  :root {
${darkCSS}
  }
}

html[data-theme="light"] {
${lightCSS}
}

html[data-theme="dark"] {
${darkCSS}
}
`;

  if (tokensState.scheme === "light" || tokensState.scheme === "dark") {
    document.documentElement.dataset.theme = tokensState.scheme;
  } else {
    delete document.documentElement.dataset.theme;
  }

  const darkActive = isCurrentDark();
  for (const d of docs) {
    d.ed?.setDark(darkActive);
    d.ed?.remeasure?.();
  }
  initMermaid();
  for (const d of docs) renderDoc(d);
  updateThemeSwitchUI();
}

const prefsEl = document.getElementById("prefs");
const mermaidSel = document.getElementById("mermaidTheme");
const tokenFormGeneral = document.getElementById("tokenFormGeneral");
const tokenFormLight = document.getElementById("tokenFormLight");
const tokenFormDark = document.getElementById("tokenFormDark");

function buildTokenForms() {
  // 1. Formulario General (Tipografía y Medida)
  if (tokenFormGeneral) {
    tokenFormGeneral.replaceChildren();
    for (const t of GENERAL_TOKENS_META) {
      if (t.group) {
        const g = document.createElement("div");
        g.className = "prefs-group";
        g.textContent = t.group;
        tokenFormGeneral.append(g);
        continue;
      }
      const row = document.createElement("div");
      row.className = "prefs-row";
      const span = document.createElement("span");
      span.textContent = t.label;
      row.append(span);

      let input;
      if (t.kind === "font") {
        input = document.createElement("select");
        const curVal = tokensState.general[t.name] ?? VERA_DEFAULTS.general[t.name];
        for (const [label, stack] of FONT_STACKS) {
          const opt = document.createElement("option");
          opt.value = stack;
          opt.textContent = label;
          if (stack === curVal) opt.selected = true;
          input.append(opt);
        }
        if (!FONT_STACKS.some(([, s]) => s === curVal)) {
          const opt = document.createElement("option");
          opt.value = curVal;
          opt.textContent = "Personalizada";
          opt.selected = true;
          input.prepend(opt);
        }
        input.addEventListener("change", () => {
          tokensState.general[t.name] = input.value;
          saveTokens();
          applyTokens();
        });
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = tokensState.general[t.name] ?? VERA_DEFAULTS.general[t.name];
        input.addEventListener("change", () => {
          tokensState.general[t.name] = input.value.trim();
          saveTokens();
          applyTokens();
        });
      }
      row.append(input);
      tokenFormGeneral.append(row);
    }
  }

  // Helper para construir sección de colores
  function buildColorSection(container, themeKey) {
    if (!container) return;
    container.replaceChildren();

    const note = document.createElement("div");
    note.className = "prefs-group";
    note.textContent = `Paleta de colores para el tema ${themeKey === "light" ? "claro" : "oscuro"}`;
    container.append(note);

    for (const meta of COLOR_TOKENS_META) {
      if (meta.group) {
        const g = document.createElement("div");
        g.className = "prefs-group";
        g.textContent = meta.group;
        container.append(g);
        continue;
      }
      const row = document.createElement("div");
      row.className = "prefs-row";
      const label = document.createElement("span");
      label.textContent = meta.label;
      row.append(label);

      const colorWrap = document.createElement("div");
      colorWrap.className = "token-color";

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      const curVal = (tokensState[themeKey][meta.name] ?? VERA_DEFAULTS[themeKey][meta.name]).trim();
      colorInput.value = /^#[0-9a-f]{6}$/i.test(curVal) ? curVal : "#000000";

      const textInput = document.createElement("input");
      textInput.type = "text";
      textInput.className = "token-hex";
      textInput.maxLength = 7;
      textInput.value = curVal;

      const updateColor = (newVal) => {
        tokensState[themeKey][meta.name] = newVal;
        saveTokens();
        applyTokens();
      };

      colorInput.addEventListener("input", () => {
        textInput.value = colorInput.value;
        updateColor(colorInput.value);
      });

      textInput.addEventListener("change", () => {
        let val = textInput.value.trim();
        if (!val.startsWith("#")) val = `#${val}`;
        if (/^#[0-9a-f]{6}$/i.test(val)) {
          colorInput.value = val;
          textInput.value = val;
          updateColor(val);
        }
      });

      colorWrap.append(colorInput, textInput);
      row.append(colorWrap);
      container.append(row);
    }
  }

  // 2. Formulario Tema Claro
  buildColorSection(tokenFormLight, "light");

  // 3. Formulario Tema Oscuro
  buildColorSection(tokenFormDark, "dark");

  // Actualizar botones de esquema activo
  document.querySelectorAll(".prefs-scheme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.scheme === tokensState.scheme);
  });
}

// Conectar pestañas del panel de preferencias
document.querySelectorAll(".prefs-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".prefs-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.tab;
    const tabGen = document.getElementById("prefTabGeneral");
    const tabLight = document.getElementById("prefTabLight");
    const tabDark = document.getElementById("prefTabDark");
    if (tabGen) tabGen.hidden = target !== "general";
    if (tabLight) tabLight.hidden = target !== "light";
    if (tabDark) tabDark.hidden = target !== "dark";
  });
});

// Selector de esquema de la app
document.querySelectorAll(".prefs-scheme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    tokensState.scheme = btn.dataset.scheme;
    saveTokens();
    applyTokens();
    document.querySelectorAll(".prefs-scheme-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
  });
});

function openPrefs() {
  if (mermaidSel) mermaidSel.value = mermaidTheme();
  buildTokenForms();
  if (prefsEl) prefsEl.hidden = false;
}

function closePrefs() {
  if (prefsEl) prefsEl.hidden = true;
}

function resetTokens() {
  tokensState = {
    general: { ...VERA_DEFAULTS.general },
    light: { ...VERA_DEFAULTS.light },
    dark: { ...VERA_DEFAULTS.dark },
    scheme: tokensState.scheme,
  };
  saveTokens();
  applyTokens();
  buildTokenForms();
}

if (prefsEl) {
  prefsEl.addEventListener("click", (e) => { if (e.target === prefsEl) closePrefs(); });
  document.getElementById("prefsClose")?.addEventListener("click", closePrefs);
  document.getElementById("prefsReset")?.addEventListener("click", resetTokens);
  mermaidSel?.addEventListener("change", () => {
    try { localStorage.setItem("luca.mermaidTheme", mermaidSel.value); } catch {}
    initMermaid();
    for (const d of docs) renderDoc(d);
  });
}

// ⌘, abre Preferencias (macOS y web)
addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === ",") {
    e.preventDefault();
    openPrefs();
  }
});

applyTokens();
buildTokenForms();

// Esc cierra preferencias si están abiertas, o sale del zen si está activo
addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (prefsEl && !prefsEl.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closePrefs();
      return;
    }
    if (document.body.dataset.zen === "on") {
      e.preventDefault();
      e.stopPropagation();
      toggleZen(false);
    }
  }
}, true);

// Estado inicial, recordado por visor (localStorage es una comodidad local).
let mode0 = "split", zen0 = "off";
try { mode0 = localStorage.getItem("luca.mode") || "split"; zen0 = localStorage.getItem("luca.zen") || "off"; } catch {}
initTopbarButtons();
applyMode(mode0);
toggleZen(zen0 === "on");

const SAMPLE = `# Luca — Editor Markdown Soberano

> *«Una manera de entender la escritura desde su forma, sus proporciones y el cuidado de sus trazos.»*  
> — Fra Luca Pacioli, *Divina proportione* (1509)

Luca es un editor Markdown local del ecosistema **MediaFranca**, diseñado para elaborar textos claros y estructurados antes de su publicación en [[Vera]]. Combina un núcleo nativo en **Tauri 2** y Rust con un entorno de edición rápido en **CodeMirror 6** y soporte integral para **Mermaid 12 offline**.

---

## Flujo de Trabajo en MediaFranca

El siguiente diagrama ilustra la arquitectura de creación, verificación y publicación soberana:

\`\`\`mermaid
flowchart LR
    A["Borrador local\n(Markdown en Luca)"] --> B["Edición y Tablas\n(CM6 + Editor Vera)"]
    B --> C["Vista Previa\n(marked + Mermaid 12)"]
    C --> D["Guardado atómico\n(Archivo .md en disco)"]
    D --> E["Publicación\n(Ecosistema Vera)"]
    E -.->|Revisión externa| A
\`\`\`

---

## Funcionalidades y Componentes

| Componente | Capacidad | Estado | Integración |
| :--- | :--- | :---: | ---: |
| **Editor CM6** | Resaltado Markdown, historial y barra de herramientas | Estable | \`ui/toolbar.js\` |
| **Mermaid offline** | Flowcharts, secuencias, ELK y ZenUML sin conexión | Integrado | \`ui/vendor/mermaid/\` |
| **Editor de tablas** | Edición bidimensional, cambio de ejes y pegado TSV | Completo | \`ui/table-editor.js\` |
| **Diseño y tokens** | Paletas independientes de Vera (Claro / Oscuro) | Activo | Preferencias (\`⌘,\`) |
| **Modo Zen** | Escritura libre de distracciones con barra retráctil | Disponible | \`⌘⇧Z\` |

---

## Modos de Trabajo

1. **Código Markdown (\`⌘1\`):** Enfoque puro en el texto fuente, ideal para redacción veloz y estructura cruda.
2. **Vista dividida (\`⌘2\`):** Sincronización simultánea entre el editor y la vista previa con renderizado de diagramas.
3. **Texto renderizado (\`⌘3\`):** Proyección tipográfica pulida para lectura, revisión y exportación a PDF.
4. **Modo Zen (\`⌘⇧Z\`):** Oculta toda la interfaz de la ventana. La barra de pestañas reaparece suavemente al acercar el cursor al borde superior.

---

## Hoja de Ruta (Roadmap)

### Hitos completados
- [x] Arquitectura multidocumento por pestañas con editor independiente por archivo
- [x] Barra de herramientas de formato tipográfico, bloques y enlaces
- [x] Editor visual de tablas Markdown reciclado del repositorio Vera
- [x] Tokens y temas independientes (Claro y Oscuro de Vera) con selector de esquema
- [x] Guardado atómico en disco con detección de cambios externos por mtime

### Próximos pasos
- [ ] Edición interactiva directa sobre la vista previa (*WYSIWYG*)
- [ ] Resolución de rutas relativas locales para imágenes y recursos vinculados
- [ ] Resaltado de sintaxis enriquecido dentro de bloques Mermaid
- [ ] Paquetes de iconos vectoriales adicionales para diagramas
`;

initMermaid();

// Esperar a que las fuentes carguen ANTES de montar el editor, para que
// CodeMirror mida las líneas con Plex Mono y no queden desalineadas.
if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }

// Arranque: si Vera/Finder lanzaron Luca con un archivo, ábrelo; si no, el ejemplo.
const pending = TAURI ? await TAURI.core.invoke("take_opened_file") : null;
if (pending) await openPath(pending);
else makeDoc(SAMPLE, null);
