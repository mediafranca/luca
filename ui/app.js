// luca — Markdown + Mermaid con recursos locales.

import { createMarkdownEditor } from "./vendor/codemirror/editor.js";
import { AUTO, detectLanguage, language, menuLabels, setLanguage, t, translatePage } from "./i18n.js";
import { createEditorToolbar, editDocumentTableAtIndex } from "./toolbar.js";
import { icon } from "./icons.js";
import { beginBlockEdit, exitBlockEdit } from "./block-edit.js";
import { externalWebUrl, isEditablePreviewMode, isInternalAnchor, scopeWikiCss } from "./preview-behavior.js";
import { moveByOffset, reorderById } from "./tab-order.js";
import { extensionMismatch, interpretedFormat } from "./document-format.js";
import DOMPurify from "./vendor/dompurify/purify.es.mjs";
import { recentPaths, sessionSnapshot, validSession } from "./session-state.js";
import { matchingCommands } from "./command-search.js";
import { detectedLineEnding, documentHeadings } from "./document-outline.js";
import { DEFAULT_DESIGN_NAME, DESIGNS_KEY, TOKENS_KEY, diagnosticReport, migrateSettings, uniqueDesignName }
  from "./settings-state.js";
import { isDisposableBlank, transferableTab } from "./window-transfer.js";

try { migrateSettings(localStorage); } catch {}

// El idioma se fija antes de que nada se dibuje: así todo rótulo —y el menú
// nativo, que Rust arma con lo que le enviemos— sale ya en el idioma correcto.
const LANG_KEY = "luca.lang";
const storedLanguage = () => {
  try { return localStorage.getItem(LANG_KEY) || AUTO; } catch { return AUTO; }
};
const resolveLanguage = (choice = storedLanguage()) =>
  choice === AUTO ? detectLanguage(navigator.languages ?? [navigator.language]) : choice;
setLanguage(resolveLanguage());

const PREVIEW_SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "meta", "link", "base"],
  FORBID_ATTR: ["style", "srcset"],
};
// Con las CSS de la wiki activadas, el HTML conserva sus <style> (TemplateStyles
// viaja ahí) pero sigue sin scripts, formularios ni marcos: el contenido vive
// aislado en un shadow root y la hoja no puede ejecutar nada.
const PREVIEW_SANITIZE_STYLED = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ["style"],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "meta", "link", "base"],
  FORBID_ATTR: ["srcset"],
};

let marked;
let mermaid;
let previewRuntimePromise;
let elkRuntimePromise;
let tidyRuntimePromise;
let zenumlRuntimePromise;

async function ensurePreviewRuntime(source = "") {
  if (!previewRuntimePromise) previewRuntimePromise = Promise.all([
    import("./vendor/marked/marked.esm.js"),
    import("./vendor/mermaid/mermaid.esm.min.mjs"),
  ]).then(([markedMod, mermaidMod]) => {
    marked = markedMod.marked;
    mermaid = mermaidMod.default;
    marked.use({
      renderer: {
        code(code, lang) {
          // Escapar siempre: el texto del fence pasa por DOMPurify y luego se lee
          // con textContent, así que `<`, `&` y `|` del diagrama llegan intactos.
          const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;");
          return lang === "mermaid"
            ? `<pre class="mermaid">${escaped}</pre>`
            : `<pre><code>${escaped}</code></pre>`;
        },
      },
    });
    initMermaid();
  });
  await previewRuntimePromise;
  const registrations = [];
  if (/\b(?:elk|layout\s*:\s*elk)\b/i.test(source)) {
    elkRuntimePromise ||= import("./vendor/layout-elk/mermaid-layout-elk.esm.min.mjs").then((mod) => mermaid.registerLayoutLoaders(mod.default));
    registrations.push(elkRuntimePromise);
  }
  if (/\b(?:tidy-tree|tidy_tree)\b/i.test(source)) {
    tidyRuntimePromise ||= import("./vendor/tidy-tree/mermaid-layout-tidy-tree.esm.min.mjs").then((mod) => mermaid.registerLayoutLoaders(mod.default));
    registrations.push(tidyRuntimePromise);
  }
  if (/\bzenuml\b/i.test(source)) {
    zenumlRuntimePromise ||= import("./vendor/zenuml/mermaid-zenuml.esm.min.mjs").then((mod) => mermaid.registerExternalDiagrams([mod.default]));
    registrations.push(zenumlRuntimePromise);
  }
  await Promise.all(registrations);
}

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const mermaidTheme = () => { try { return localStorage.getItem("luca.mermaidTheme") || "vera"; } catch { return "vera"; } };

// Mermaid: por defecto "vera" = tema 'base' tokenizado a los colores de Vera,
// así el diagrama hereda la paleta de la app (claro/oscuro). El usuario puede
// elegir otro preset desde Preferencias.
function initMermaid() {
  if (!mermaid) return;
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

// ---------- Multi-documento ----------
// Cada documento tiene su propio editor y su propio preview; una apertura nueva
// NO cierra ni reemplaza a los demás (contrato con Vera). El texto se guarda tal
// cual: Vera lleva las identidades en su manifiesto lateral, luca no inyecta nada.
const tabsEl = document.getElementById("tabs");
const editorsEl = document.getElementById("editors");
const previewsEl = document.getElementById("previews");
const TAURI = window.__TAURI__;
const windowLabel = TAURI?.window?.getCurrentWindow?.().label || "web";

const docs = [];     // documentos abiertos
let active = null;   // documento activo
let seq = 0;         // ids de mermaid, únicos entre TODOS los documentos
let nextId = 1;
let draggedTabId = null;
let restoringSession = false;
let sessionTimer = null;

const SESSION_KEY = "luca.session.v1";
const sessionStorageKey = `${SESSION_KEY}.${windowLabel}`;
const RECENT_KEY = "luca.recentFiles";
const readJsonStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
};
function saveSessionSoon() {
  if (restoringSession) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(saveSessionNow, 120);
}
function saveSessionNow() {
  if (restoringSession) return;
  const snapshot = sessionSnapshot(docs.map((doc) => ({ ...doc, content: doc.ed.getSource() })), active?.id);
  try { localStorage.setItem(sessionStorageKey, JSON.stringify(snapshot)); } catch {}
}
function rememberRecent(path) {
  if (!path) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentPaths(readJsonStorage(RECENT_KEY, []), path))); } catch {}
  renderRecentFiles();
}
function renderRecentFiles() {
  // Los recientes viven en el submenú nativo «Archivo ▸ Abrir reciente».
  if (!TAURI) return;
  TAURI.core.invoke("set_recent_files", { paths: readJsonStorage(RECENT_KEY, []) }).catch(() => {});
}
async function openRecent(index) {
  const path = readJsonStorage(RECENT_KEY, [])[index];
  if (!path) return;
  try { await openPath(path); }
  catch { alert(t("dialog.recent_failed", { path })); }
}
function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch {}
  renderRecentFiles();
}

const FORMAT_OVERRIDES_KEY = "luca.documentFormats";
const NEW_FORMAT_KEY = "luca.newDocumentFormat";
const readFormatOverrides = () => {
  try { return JSON.parse(localStorage.getItem(FORMAT_OVERRIDES_KEY) || "{}"); } catch { return {}; }
};
const formatSelectionFor = (path) => path ? (readFormatOverrides()[path] || "auto") : "auto";
const newDocumentFormat = () => {
  try { return localStorage.getItem(NEW_FORMAT_KEY) || "markdown"; } catch { return "markdown"; }
};
// ---------- Servidores de wiki para la vista previa Wikitext ----------
// Wikitext sólo lo interpreta MediaWiki, así que la preview se le pide a una
// instalación concreta: cualquiera con api.php pública sirve. La lista se
// guarda local, como el resto de las preferencias.
const WIKI_SERVERS_KEY = "luca.wikiServers";
const WIKI_API_KEY = "luca.wikiApi";
const WIKI_STYLES_KEY = "luca.wikiStyles";
const WIKI_STYLE_MODULES_KEY = "luca.wikiStyleModules";
const DEFAULT_WIKI_SERVERS = [
  { name: "Casiopea (e[ad] PUCV)", api: "https://wiki.ead.pucv.cl/api.php" },
  { name: "Wikipedia (es)", api: "https://es.wikipedia.org/w/api.php" },
  { name: "Wikipedia (en)", api: "https://en.wikipedia.org/w/api.php" },
  { name: "Wikimedia Commons", api: "https://commons.wikimedia.org/w/api.php" },
];
function wikiServers() {
  try {
    const saved = JSON.parse(localStorage.getItem(WIKI_SERVERS_KEY) || "null");
    const list = (Array.isArray(saved) ? saved : [])
      .filter((server) => server && typeof server.api === "string" && server.api.startsWith("https://"))
      .map((server) => ({ name: String(server.name || server.api), api: server.api }));
    if (list.length) return list;
  } catch {}
  return DEFAULT_WIKI_SERVERS.map((server) => ({ ...server }));
}
const saveWikiServers = (list) => {
  try { localStorage.setItem(WIKI_SERVERS_KEY, JSON.stringify(list)); } catch {}
};
const wikiApi = () => {
  try { return localStorage.getItem(WIKI_API_KEY) || wikiServers()[0].api; }
  catch { return DEFAULT_WIKI_SERVERS[0].api; }
};
const wikiServerLabel = (api = wikiApi()) => {
  const saved = wikiServers().find((server) => server.api === api);
  if (saved) return saved.name;
  try { return new URL(api).host; } catch { return api; }
};
const wikiStylesOn = () => {
  try { return localStorage.getItem(WIKI_STYLES_KEY) === "on"; } catch { return false; }
};
const wikiExtraModules = () => {
  try { return (localStorage.getItem(WIKI_STYLE_MODULES_KEY) || "").split(/[\s,|]+/).filter(Boolean); }
  catch { return []; }
};
const wikiTitle = (doc) => {
  try { return localStorage.getItem("luca.wikiTitle") || baseName(doc.path).replace(/\.[^.]+$/, "") || "Luca/Preview"; }
  catch { return "Luca/Preview"; }
};
const rememberFormatSelection = (doc) => {
  try {
    if (!doc.path) return;
    const values = readFormatOverrides();
    if (doc.formatSelection === "auto") delete values[doc.path];
    else values[doc.path] = doc.formatSelection;
    localStorage.setItem(FORMAT_OVERRIDES_KEY, JSON.stringify(values));
  } catch {}
};

// Una sola barra de herramientas, en la barra superior; opera sobre el
// documento activo (el getter resuelve `doc.ed` en cada clic).
document.getElementById("modes").after(createEditorToolbar({
  get ed() { return active?.block?.ed ?? active?.ed; },
  get format() { return active?.format ?? "markdown"; },
}));

const dark = () => isCurrentDark();
const baseName = (p) => (p ? p.split(/[\\/]/).pop() : t("ui.tab.untitled"));

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
      t.innerHTML = DOMPurify.sanitize(marked.parser([tok]), PREVIEW_SANITIZE_OPTIONS);
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

// ---------- Vista previa Wikitext: HTML y estilos de la wiki ----------
const wikiNotice = (text) => {
  const el = document.createElement("p");
  el.className = "wiki-preview-status";
  el.textContent = text;
  return el;
};

// El HTML de MediaWiki trae rutas relativas a la wiki; aquí se resuelven y se
// descarta cualquier esquema que no sea http(s).
function absolutizeWikiUrls(fragment, api) {
  let origin;
  try { origin = new URL(api).origin; } catch { return; }
  for (const el of fragment.querySelectorAll("[href], [src]")) {
    for (const attr of ["href", "src"]) {
      const raw = el.getAttribute(attr);
      if (!raw) continue;
      try {
        const resolved = new URL(raw, origin);
        if (!["http:", "https:"].includes(resolved.protocol)) el.removeAttribute(attr);
        else el.setAttribute(attr, resolved.href);
      } catch { el.removeAttribute(attr); }
    }
  }
}

// Las skins eligen su paleta con light-dark(), que resuelve según el
// color-scheme computado del elemento. La hoja de la wiki lo fija en su :root;
// un estilo en línea sobre el host gana a esa regla, así que la vista previa
// sigue el claro/oscuro de Luca sin volver a pedir el parseo ni las CSS.
// Una skin que sólo use @media (prefers-color-scheme) seguirá al sistema, no a
// Luca: eso no lo podemos gobernar desde aquí.
const applyWikiScheme = (host) => {
  host.style.colorScheme = isCurrentDark() ? "dark" : "light";
};

const refreshWikiScheme = () => {
  for (const host of document.querySelectorAll(".wiki-styled")) applyWikiScheme(host);
};

// Base mínima dentro del shadow root: la hoja de la wiki viene después y manda.
const WIKI_SHADOW_BASE = `:host { display:block; }
.wiki-body { background:#fff; color:#202122;
  font-family:var(--font-read, 'IBM Plex Sans', system-ui, sans-serif); font-size:14px;
  line-height:1.6; min-height:100%; box-sizing:border-box;
  padding:1.6em max(1.6em, calc((100% - 52em) / 2)); }
.wiki-body img { max-width:100%; height:auto; }
`;

// Un pedido de load.php por endpoint y lista de módulos; el fallo se cachea
// como hoja vacía para no reintentar en cada tecla.
const wikiStyleSheets = new Map();
function wikiStyleSheet(api, modules) {
  const list = [...new Set(["site.styles", ...modules, ...wikiExtraModules()])];
  const key = `${api}\n${list.join("|")}`;
  if (!wikiStyleSheets.has(key)) {
    wikiStyleSheets.set(key, TAURI.core.invoke("fetch_wiki_styles", { apiUrl: api, modules: list })
      .then((css) => {
        let origin = "";
        try { origin = new URL(api).origin; } catch {}
        return scopeWikiCss(css.replace(/url\((\s*['"]?)\/(?!\/)/g, (_, quote) => `url(${quote}${origin}/`));
      })
      .catch(() => ""));
  }
  return wikiStyleSheets.get(key);
}

async function showWikiHtml(doc, cache, renderVersion) {
  const template = document.createElement("template");
  template.innerHTML = cache.html;
  if (!wikiStylesOn()) {
    doc.previewEl.replaceChildren(template.content);
    return;
  }
  const css = await wikiStyleSheet(cache.api, cache.modules);
  if (renderVersion !== doc.renderVersion) return;
  const host = document.createElement("div");
  host.className = "wiki-styled";
  const style = document.createElement("style");
  style.textContent = WIKI_SHADOW_BASE + css;
  const body = document.createElement("div");
  body.className = "wiki-body mw-body-content";
  body.append(template.content);
  applyWikiScheme(host);
  host.attachShadow({ mode: "open" }).append(style, body);
  doc.previewEl.setAttribute("data-wiki-styles", "");
  doc.previewEl.replaceChildren(host);
}

async function renderDoc(doc, force = false) {
  if (doc.block) return;   // hay un bloque en edición: se renderiza al salir
  if (!force && document.body.dataset.mode === "source") return;
  const renderVersion = ++doc.renderVersion;
  // La bandera sólo la pone showWikiHtml cuando de verdad aplica las CSS de la
  // wiki: aquí se limpia para que no sobreviva a un cambio de formato ni al
  // apagar el interruptor (con ella puesta, el panel va sin su medida).
  doc.previewEl.removeAttribute("data-wiki-styles");
  if (doc.format === "wikitext") {
    const api = wikiApi();
    if (!TAURI) {
      setWikiState(doc, "unavailable", "wiki.state.unavailable");
      doc.previewEl.replaceChildren(wikiNotice(t("wiki.notice.browser", { api })));
      return;
    }
    setWikiState(doc, "loading", "wiki.state.loading");
    try {
      const parsed = await TAURI.core.invoke("parse_wikitext", { apiUrl: api, title: wikiTitle(doc), text: doc.ed.getDoc() });
      if (renderVersion !== doc.renderVersion) return;
      const styled = wikiStylesOn();
      const clean = DOMPurify.sanitize(parsed.html, styled ? PREVIEW_SANITIZE_STYLED : PREVIEW_SANITIZE_OPTIONS);
      const template = document.createElement("template");
      template.innerHTML = clean;
      absolutizeWikiUrls(template.content, api);
      doc.wikiCache = { api, html: template.innerHTML, modules: parsed.modules ?? [] };
      await showWikiHtml(doc, doc.wikiCache, renderVersion);
      if (renderVersion !== doc.renderVersion) return;
      setWikiState(doc, "ok", "wiki.state.ok");
    } catch (error) {
      if (renderVersion !== doc.renderVersion) return;
      const reason = t(navigator.onLine ? "wiki.reason.error" : "wiki.reason.offline", { error });
      if (doc.wikiCache?.api === api) {
        await showWikiHtml(doc, doc.wikiCache, renderVersion);
        if (renderVersion !== doc.renderVersion) return;
        setWikiState(doc, "cache", "wiki.state.cache", { reason });
      } else {
        doc.previewEl.replaceChildren(wikiNotice(t("wiki.notice.none", { api, reason })));
        setWikiState(doc, navigator.onLine ? "error" : "offline",
          navigator.onLine ? "wiki.reason.error" : "wiki.reason.offline", { error });
      }
    }
    return;
  }
  const source = doc.ed.getDoc();
  await ensurePreviewRuntime(source);
  if (renderVersion !== doc.renderVersion) return;
  doc.previewEl.replaceChildren(renderBlocks(source));

  // Resolver rutas relativas de imágenes y medios locales respecto al archivo abierto
  const docDir = getDocDir(doc);
  if (docDir) {
    const mediaEls = doc.previewEl.querySelectorAll("img, video, audio, source");
    for (const el of mediaEls) {
      const rawSrc = el.getAttribute("src");
      if (!rawSrc) continue;
      if (/^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/i.test(rawSrc.trim())) continue;
      const absPath = resolveDocPath(docDir, rawSrc);
      try {
        const allowedPath = TAURI
          ? await TAURI.core.invoke("allow_preview_asset", { path: absPath })
          : absPath;
        el.src = toAssetUrl(allowedPath);
      } catch {
        el.removeAttribute("src");
        el.title = t("preview.asset_blocked");
      }
    }
  }

  for (const block of doc.previewEl.querySelectorAll("pre.mermaid")) {
    const def = block.textContent;
    try {
      const { svg, bindFunctions } = await mermaid.render(`luca-d${seq++}`, def);
      if (renderVersion !== doc.renderVersion) return;
      block.innerHTML = svg;
      bindFunctions?.(block);
    } catch (err) {
      block.className = "mermaid-error";
      block.textContent = t("preview.mermaid_error", { error: err?.message ?? err });
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
    editBtn.title = t("table.edit");
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editDocumentTableAtIndex(doc, tableIndex);
    });
    wrapper.append(editBtn);
  });
  syncPreview(doc);
}

// 150 ms de debounce por documento; renderVersion descarta resultados obsoletos.
function onEdit(doc) {
  if (!doc.dirty) { doc.dirty = true; renderTabs(); if (doc === active) setTitle(); }
  clearTimeout(doc.t);
  saveSessionSoon();
  updateOutline(doc);
  if (document.body.dataset.mode === "source") return;
  doc.t = setTimeout(() => renderDoc(doc), doc.format === "wikitext" ? 650 : 150);
}

function renderTabs() {
  tabsEl.replaceChildren(...docs.map((doc) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (doc === active ? " active" : "");
    tab.role = "tab";
    tab.tabIndex = doc === active ? 0 : -1;
    tab.ariaSelected = doc === active ? "true" : "false";
    tab.setAttribute("aria-controls", `editor-${doc.id}`);
    tab.draggable = true;
    tab.title = doc.path ?? t("ui.tab.unsaved");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = (doc.dirty ? "• " : "") + baseName(doc.path);
    const close = document.createElement("button");
    close.className = "close";
    close.textContent = "×";
    close.title = t("ui.tab.close");
    close.setAttribute("aria-label", t("ui.tab.close_named", { name: baseName(doc.path) }));
    // Activar redibuja las pestañas y destruiría este botón: el × no propaga
    // ni el mousedown ni el click, así cerrar no activa primero.
    close.addEventListener("mousedown", (e) => e.stopPropagation());
    close.addEventListener("click", (e) => { e.stopPropagation(); closeDoc(doc); });
    tab.append(label, close);
    // En click, no en mousedown: activate() rehace la barra de pestañas y, si
    // el nodo muere durante el gesto, el arrastre para reordenar no arranca.
    // Un arrastre consumado no emite click, así que soltar no activa de más.
    tab.addEventListener("click", () => activate(doc));
    tab.addEventListener("keydown", (e) => {
      if (!e.altKey && !e.shiftKey && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const index = docs.indexOf(doc);
        const target = e.key === "Home" ? docs[0]
          : e.key === "End" ? docs.at(-1)
          : docs[(index + (e.key === "ArrowLeft" ? -1 : 1) + docs.length) % docs.length];
        activate(target);
        tabsEl.querySelector('[aria-selected="true"]')?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate(doc);
      } else if (e.altKey && e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        moveTab(doc, -1);
      } else if (e.altKey && e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        moveTab(doc, 1);
      }
    });
    tab.addEventListener("dragstart", (e) => {
      draggedTabId = doc.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(doc.id));
      tab.classList.add("dragging");
    });
    tab.addEventListener("dragover", (e) => {
      if (draggedTabId === null || draggedTabId === doc.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      tab.classList.add("drop-target");
    });
    tab.addEventListener("dragleave", () => tab.classList.remove("drop-target"));
    tab.addEventListener("drop", (e) => {
      e.preventDefault();
      const rect = tab.getBoundingClientRect();
      const placement = e.clientX >= rect.left + rect.width / 2 ? "after" : "before";
      reorderTab(draggedTabId, doc.id, placement);
      draggedTabId = null;
    });
    tab.addEventListener("dragend", async (event) => {
      const detached = event.dataTransfer?.dropEffect === "none" &&
        (event.screenX !== 0 || event.screenY !== 0) &&
        (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= innerWidth || event.clientY >= innerHeight);
      draggedTabId = null;
      tab.classList.remove("dragging", "drop-target");
      if (detached) {
        try {
          const target = await TAURI?.core.invoke("window_at_point", { x: event.screenX, y: event.screenY, exclude: windowLabel });
          await moveTabToWindow(doc, target || null);
        } catch (error) { alert(error); }
      }
    });
    return tab;
  }));
}

function replaceTabOrder(next) {
  docs.splice(0, docs.length, ...next);
  renderTabs();
  tabsEl.querySelector('[aria-selected="true"]')?.focus();
  saveSessionSoon();
}

function reorderTab(movedId, targetId, placement) {
  replaceTabOrder(reorderById(docs, movedId, targetId, placement));
}

function moveTab(doc, offset) {
  replaceTabOrder(moveByOffset(docs, doc.id, offset));
}

function activate(doc) {
  if (active && active !== doc) exitBlockEdit(active);
  active = doc;
  for (const d of docs) { d.editorEl.hidden = d !== doc; d.previewEl.hidden = d !== doc; }
  renderTabs();
  setTitle();
  updateFormatControls(doc);
  updateOutline(doc);
  updateCursorStatus(doc);
  saveSessionSoon();
  doc.ed.focus();
}

function makeDoc(initialDoc, path, selection = null, restored = {}) {
  const editorEl = document.createElement("div");
  editorEl.className = "doc-editor";
  const cmMount = document.createElement("div");
  cmMount.className = "doc-editor-cm";

  const previewEl = document.createElement("div");
  previewEl.className = "doc-preview";
  editorsEl.append(editorEl);
  previewsEl.append(previewEl);

  const formatSelection = selection ?? formatSelectionFor(path);
  const fallback = path ? "markdown" : newDocumentFormat();
  const doc = {
    id: nextId++,
    path: path ?? null,
    dirty: Boolean(restored.dirty),
    lastMtime: restored.lastMtime ?? null,
    editorEl,
    cmMount,
    previewEl,
    ed: null,
    t: null,
    block: null,   // bloque en edición en la vista renderizada (block-edit.js)
    renderVersion: 0,
    wikiCache: null,
    lineEnding: restored.lineEnding || detectedLineEnding(initialDoc),
    formatSelection,
    format: interpretedFormat(path, formatSelection, fallback),
  };

  editorEl.id = `editor-${doc.id}`;
  editorEl.setAttribute("role", "tabpanel");
  editorEl.setAttribute("aria-label", t("ui.editor_of", { name: baseName(path) }));
  previewEl.id = `preview-${doc.id}`;
  previewEl.setAttribute("role", "region");
  previewEl.setAttribute("aria-label", t("ui.preview_of", { name: baseName(path) }));

  doc.ed = createMarkdownEditor({
    parent: cmMount,
    doc: initialDoc,
    dark: isCurrentDark(),
    onChange: () => onEdit(doc),
    onCursor: () => { syncPreview(doc); updateCursorStatus(doc); },
    format: doc.format,
    lineSeparator: doc.lineEnding === "CRLF" ? "\r\n" : doc.lineEnding === "CR" ? "\r" : "\n",
    stateJson: restored.editorState || null,
  });
  if (restored.scroll) doc.ed.setScroll(restored.scroll);
  editorEl.append(cmMount);

  docs.push(doc);
  activate(doc);
  if (document.body.dataset.mode !== "source") renderDoc(doc);
  return doc;
}

const findByPath = (path) => docs.find((d) => d.path && d.path === path);

async function openPath(path) {
  const existing = findByPath(path);        // contrato: reabrir reutiliza, no duplica
  if (existing) { activate(existing); return existing; }
  if (TAURI) {
    const owner = await TAURI.core.invoke("claim_document", { path, windowLabel });
    if (owner) { await TAURI.core.invoke("focus_window", { label: owner }); return null; }
  }
  try {
    const content = await TAURI.core.invoke("read_file", { path });
    const doc = makeDoc(content, path);
    doc.lastMtime = await TAURI.core.invoke("stat", { path });
    rememberRecent(path);
    return doc;
  } catch (error) {
    if (TAURI) await TAURI.core.invoke("release_document", { path, windowLabel }).catch(() => {});
    throw error;
  }
}

async function openFile() {
  const path = await TAURI.dialog.open({ filters: [{ name: t("dialog.filter.markup"), extensions: ["md", "markdown", "wiki", "wikitext", "txt"] }] });
  if (typeof path === "string") await openPath(path);
}

async function saveDoc(doc, forceDialog = false) {
  const previousPath = doc.path;
  let path = previousPath;
  const isNew = forceDialog || !path;
  if (isNew) {
    const ext = doc.format === "wikitext" ? "wiki" : "md";
    path = await TAURI.dialog.save({ defaultPath: doc.path ?? `${t("dialog.untitled_file")}.${ext}`, filters: [{ name: t("dialog.filter.markup"), extensions: ["md", "markdown", "wiki", "wikitext"] }] });
    if (!path) return;
  } else {
    // ¿cambió fuera de luca (p.ej. Vera) desde que lo leímos? No pisar en silencio.
    const cur = await TAURI.core.invoke("stat", { path });
    if (cur !== null && doc.lastMtime !== null && cur !== doc.lastMtime &&
        // En Tauri el plugin de diálogos vuelve confirm() asíncrono: sin await la
        // condición nunca bloquea y se sobrescribe antes de que el autor responda.
        !(await confirm(t("dialog.external_change")))) return;
  }
  const claimsNewPath = Boolean(TAURI && path !== previousPath);
  if (claimsNewPath) {
    const owner = await TAURI.core.invoke("claim_document", { path, windowLabel });
    if (owner) { await TAURI.core.invoke("focus_window", { label: owner }); return; }
  }
  try {
    doc.lastMtime = await TAURI.core.invoke("write_file", { path, contents: doc.ed.getSource() });
  } catch (error) {
    if (claimsNewPath) await TAURI.core.invoke("release_document", { path, windowLabel }).catch(() => {});
    throw error;
  }
  doc.path = path; doc.dirty = false;
  if (claimsNewPath && previousPath) {
    TAURI.core.invoke("release_document", { path: previousPath, windowLabel }).catch(() => {});
  }
  if (doc.formatSelection === "auto") {
    doc.format = interpretedFormat(path, "auto", newDocumentFormat());
    doc.ed.setFormat(doc.format);
  }
  rememberFormatSelection(doc);
  rememberRecent(path);
  renderTabs(); if (doc === active) setTitle();
  updateFormatControls(doc);
  renderDoc(doc);
  saveSessionSoon();
}

const newDoc = () => makeDoc("", null, newDocumentFormat());

async function closeDoc(doc, { force = false, release = true, replacement = true } = {}) {
  if (!force && doc.dirty && !(await confirm(t("dialog.unsaved", { name: baseName(doc.path) })))) return false;
  const i = docs.indexOf(doc);
  exitBlockEdit(doc, false);
  doc.editorEl.remove();
  doc.previewEl.remove();
  docs.splice(i, 1);
  if (release && doc.path && TAURI) TAURI.core.invoke("release_document", { path: doc.path, windowLabel }).catch(() => {});
  if (docs.length === 0) { if (replacement) newDoc(); return true; }
  if (active === doc) activate(docs[Math.min(i, docs.length - 1)]);
  else renderTabs();
  saveSessionSoon();
  return true;
}

async function moveTabToWindow(doc, target = null) {
  if (!TAURI || !doc) return;
  const targetLabel = target || await TAURI.core.invoke("create_editor_window");
  await TAURI.core.invoke("transfer_tab", { target: targetLabel, payload: transferableTab(doc, document.body.dataset.mode) });
  await closeDoc(doc, { force: true, release: false, replacement: false });
  if (docs.length === 0) await TAURI.window.getCurrentWindow().close();
}

async function receiveTransferredTabs() {
  if (!TAURI) return;
  const incoming = await TAURI.core.invoke("take_transferred_tabs", { windowLabel });
  if (incoming.length && docs.length === 1 && isDisposableBlank(docs[0])) {
    await closeDoc(docs[0], { force: true, replacement: false });
  }
  for (const payload of incoming) {
    const doc = makeDoc(payload.editorState?.doc || "", payload.path, payload.formatSelection || "auto", payload);
    if (payload.mode) applyMode(payload.mode);
    rememberRecent(payload.path);
    activate(doc);
  }
}

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  initMermaid();
  for (const d of docs) { d.ed.setDark(dark()); renderDoc(d); }
});

// Atajos por teclado globales (en fase de captura para responder aun con foco en CodeMirror)
addEventListener(
  "keydown",
  (e) => {
    if (e.key === "F1") { e.preventDefault(); openShortcuts(); return; }
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (e.shiftKey && k === "n") { e.preventDefault(); TAURI?.core.invoke("create_editor_window"); }
    else if (e.shiftKey && k === "m") { e.preventDefault(); moveTabToWindow(active).catch((error) => alert(error)); }
    else if (e.shiftKey && k === "p") { e.preventDefault(); openCommandPalette(); }
    else if (k === "n") { e.preventDefault(); newDoc(); }
    else if (k === "w") { e.preventDefault(); if (active) closeDoc(active); }
    else if (e.shiftKey && k === "z") { e.preventDefault(); toggleZen(); }
    else if (e.key === "1") { e.preventDefault(); applyMode("source"); }
    else if (e.key === "2") { e.preventDefault(); applyMode("split"); }
    else if (e.key === "3") { e.preventDefault(); applyMode("rendered"); }
    else if (e.key === ",") { e.preventDefault(); openPrefs(); }
    // El menú nativo ya trae CmdOrCtrl+E, pero en macOS eso es sólo ⌘E y
    // CodeMirror se queda con Ctrl+E (fin de línea, estilo emacs). Aquí valen
    // los dos; exportPdf se protege de una segunda llamada.
    else if (k === "e") { e.preventDefault(); exportPdf(); }
  },
  true
);

if (TAURI) {
  TAURI.event.listen("open-file", (e) => openPath(e.payload)); // apertura en caliente: añade pestaña
  TAURI.event.listen("launch-request", () => drainLaunchRequest());
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
    else if (id === "outline") toggleOutline();
    else if (id === "recent_clear") clearRecent();
    else if (id.startsWith("recent:")) openRecent(Number(id.slice(7)));
    else if (id === "move_tab_left") { if (a) moveTab(a, -1); }
    else if (id === "move_tab_right") { if (a) moveTab(a, 1); }
    else if (id === "about") openAbout();
    else if (id === "select_next_occurrence") { a?.ed.selectNextOccurrence(); }
    else if (id === "command_palette") openCommandPalette();
    else if (id === "shortcuts") openShortcuts();
    else if (id === "new_window") TAURI.core.invoke("create_editor_window");
    else if (id === "detach_tab") moveTabToWindow(a).catch((error) => alert(error));
    else if (id === "gather_windows") TAURI.core.invoke("gather_windows", { target: windowLabel });
  });
  TAURI.event.listen("tab-transfer-available", receiveTransferredTabs);
  TAURI.event.listen("gather-tabs", (event) => {
    const target = event.payload;
    Promise.all([...docs].map((doc) => moveTabToWindow(doc, target))).catch((error) => alert(error));
  });
}

// ---------- Vista dividida: proporción arrastrable y scroll a la par ----------
const workspaceEl = document.getElementById("workspace");
const dividerEl = document.getElementById("divider");
const outlineDividerEl = document.getElementById("outlineDivider");

// Arrastre de una columna del área de trabajo: el divisor captura el puntero y
// al soltar se guarda la medida y se remide la tipografía del editor.
function dragColumn(divider, { move, reset }) {
  if (!divider) return;
  divider.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);
    const rect = workspaceEl.getBoundingClientRect();
    const onMove = (ev) => move(ev, rect);
    const onUp = () => {
      divider.removeEventListener("pointermove", onMove);
      divider.removeEventListener("pointerup", onUp);
      active?.ed.remeasure();
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onUp);
  });
  divider.addEventListener("dblclick", () => { reset(); active?.ed.remeasure(); });
}

try { const s = localStorage.getItem("luca.split"); if (s) workspaceEl.style.setProperty("--split", s); } catch {}
dragColumn(dividerEl, {
  move: (ev, rect) => {
    const outline = outlineDividerEl && !outlineDividerEl.offsetParent ? 0 : (outlineEl?.offsetWidth ?? 0);
    const left = rect.left + outline;
    const width = rect.width - outline;
    const pct = Math.min(80, Math.max(20, ((ev.clientX - left) / width) * 100));
    workspaceEl.style.setProperty("--split", `${pct.toFixed(1)}%`);
    try { localStorage.setItem("luca.split", workspaceEl.style.getPropertyValue("--split")); } catch {}
  },
  reset: () => {
    workspaceEl.style.removeProperty("--split");
    try { localStorage.removeItem("luca.split"); } catch {}
  },
});

// Ancho del panel de esquema: 8–28 rem, recordado como el resto de la vista.
const OUTLINE_WIDTH_KEY = "luca.outlineWidth";
try { const w = localStorage.getItem(OUTLINE_WIDTH_KEY); if (w) workspaceEl.style.setProperty("--outline-w", w); } catch {}
dragColumn(outlineDividerEl, {
  move: (ev, rect) => {
    const px = Math.min(448, Math.max(128, ev.clientX - rect.left));
    workspaceEl.style.setProperty("--outline-w", `${Math.round(px)}px`);
    try { localStorage.setItem(OUTLINE_WIDTH_KEY, workspaceEl.style.getPropertyValue("--outline-w")); } catch {}
  },
  reset: () => {
    workspaceEl.style.removeProperty("--outline-w");
    try { localStorage.removeItem(OUTLINE_WIDTH_KEY); } catch {}
  },
});

// ---------- Formato por documento ----------
const formatSelect = document.getElementById("documentFormat");
const formatWarning = document.getElementById("formatWarning");
const editorToolbar = document.querySelector(".editor-toolbar");
const outlineEl = document.getElementById("outline");
const outlineBtn = document.getElementById("outlineBtn");
const OUTLINE_KEY = "luca.outline";

function updateCursorStatus(doc) {
  if (!doc || doc !== active) return;
  const location = doc.ed.getCursorLocation();
  const cursor = document.getElementById("cursorStatus");
  const encoding = document.getElementById("encodingStatus");
  if (cursor) cursor.textContent = t("status.cursor", { line: location.line, column: location.column });
  if (encoding) encoding.textContent = t("status.encoding", { ending: doc.lineEnding });
}

// El estado de la preview Wikitext vive al pie, junto al formato: nombre de la
// wiki y en qué está (actualizando, actual, en caché, error o sin conexión).
// Nunca se presenta una respuesta cacheada como actual.
const wikiStatusEl = document.getElementById("wikiStatus");
const wikiStatusSepEl = document.getElementById("wikiStatusSep");

// Se guarda la clave y sus parámetros, no el texto: así cambiar de idioma
// vuelve a redactar el estado sin tener que volver a consultar la wiki.
function setWikiState(doc, state, key, params) {
  doc.wikiState = { state, key, params };
  if (doc === active) updateWikiStatus(doc);
}

const wikiStateText = ({ key, params }) =>
  t("wiki.status.detail", { label: wikiServerLabel(), detail: t(key, params) });

function updateWikiStatus(doc) {
  if (!wikiStatusEl) return;
  const show = doc?.format === "wikitext" && Boolean(doc.wikiState);
  wikiStatusEl.hidden = !show;
  if (wikiStatusSepEl) wikiStatusSepEl.hidden = !show;
  if (!show) return;
  const text = wikiStateText(doc.wikiState);
  wikiStatusEl.textContent = text;
  wikiStatusEl.dataset.state = doc.wikiState.state;
  wikiStatusEl.title = t("wiki.status.full", { text, api: wikiApi() });
}

wikiStatusEl?.addEventListener("click", () => openPrefs("wiki"));

// Panel lateral de encabezados (apagado por defecto; botón en la barra, menú
// Vista y paleta). Salta al encabezado elegido en el editor.
function updateOutline(doc) {
  const list = outlineEl?.querySelector("ul");
  if (!list || outlineEl.hidden || !doc || doc !== active) return;
  const headings = documentHeadings(doc.ed.getDoc(), doc.format);
  list.replaceChildren(...headings.map((heading) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = heading.label;
    button.title = heading.label;
    button.style.setProperty("--level", String(Math.max(1, heading.level)));
    button.addEventListener("click", () => {
      if (!active) return;
      active.ed.setSelection(heading.offset);
      active.ed.focus();
    });
    item.append(button);
    return item;
  }));
  if (!headings.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = t("ui.outline.empty");
    list.append(empty);
  }
}

function setOutline(on) {
  if (!outlineEl) return;
  outlineEl.hidden = !on;
  document.body.dataset.outline = on ? "on" : "off";
  outlineBtn?.setAttribute("aria-pressed", String(on));
  outlineBtn?.classList.toggle("active", on);
  try { localStorage.setItem(OUTLINE_KEY, on ? "on" : "off"); } catch {}
  if (on && active) updateOutline(active);
  active?.ed.remeasure?.();
}
const toggleOutline = () => setOutline(Boolean(outlineEl?.hidden));
if (outlineBtn) outlineBtn.innerHTML = icon("list");
outlineBtn?.addEventListener("click", toggleOutline);
try { setOutline(localStorage.getItem(OUTLINE_KEY) === "on"); } catch { setOutline(false); }

function updateFormatControls(doc) {
  if (!doc || !formatSelect) return;
  formatSelect.value = doc.formatSelection;
  formatWarning.hidden = !extensionMismatch(doc.path, doc.formatSelection);
  formatWarning.title = formatWarning.hidden ? "" : t("status.format.warning.detail");
  // La barra no se oculta en Wikitext: adapta su marcado al formato del documento.
  if (editorToolbar) { editorToolbar.hidden = false; editorToolbar.refresh?.(doc.format); }
  document.body.dataset.format = doc.format;
  updateWikiStatus(doc);
  updateOutline(doc);
}

formatSelect?.addEventListener("change", () => {
  if (!active) return;
  active.formatSelection = formatSelect.value;
  active.format = interpretedFormat(active.path, active.formatSelection, newDocumentFormat());
  active.ed.setFormat(active.format);
  if (!active.path) {
    try { localStorage.setItem(NEW_FORMAT_KEY, active.format); } catch {}
  }
  rememberFormatSelection(active);
  updateFormatControls(active);
  renderDoc(active);
  saveSessionSoon();
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
  if (active && !isEditablePreviewMode(m)) exitBlockEdit(active);
  if (active && m !== "source") renderDoc(active);
  if (active) syncPreview(active);
}

const shortcutPrefix = navigator.platform?.includes("Mac") ? "⌘" : "Ctrl+";
const commandList = () => [
  { label: t("cmd.new"), shortcut: `${shortcutPrefix}N`, run: newDoc },
  { label: t("cmd.new_window"), shortcut: `${shortcutPrefix}Shift+N`, run: () => TAURI?.core.invoke("create_editor_window") },
  { label: t("cmd.detach"), shortcut: `${shortcutPrefix}Shift+M`, run: () => moveTabToWindow(active) },
  { label: t("cmd.open"), shortcut: `${shortcutPrefix}O`, run: openFile },
  { label: t("cmd.save"), shortcut: `${shortcutPrefix}S`, run: () => active && saveDoc(active) },
  { label: t("cmd.save_as"), shortcut: `${shortcutPrefix}Shift+S`, run: () => active && saveDoc(active, true) },
  { label: t("cmd.close_tab"), shortcut: `${shortcutPrefix}W`, run: () => active && closeDoc(active) },
  { label: t("cmd.find"), shortcut: `${shortcutPrefix}F`, run: () => active?.ed.openSearch() },
  { label: t("cmd.select_all_matches"), shortcut: `${shortcutPrefix}Shift+L`, run: () => active?.ed.selectAllMatches() },
  { label: t("cmd.goto_line"), shortcut: `${shortcutPrefix}Alt+G`, run: () => active?.ed.gotoLine() },
  { label: t("cmd.mode_source"), shortcut: `${shortcutPrefix}1`, run: () => applyMode("source") },
  { label: t("cmd.mode_split"), shortcut: `${shortcutPrefix}2`, run: () => applyMode("split") },
  { label: t("cmd.mode_rendered"), shortcut: `${shortcutPrefix}3`, run: () => applyMode("rendered") },
  { label: t("cmd.zen"), shortcut: `${shortcutPrefix}Shift+Z`, run: () => toggleZen() },
  { label: t("cmd.outline"), shortcut: "", run: () => toggleOutline() },
  { label: t("cmd.prefs"), shortcut: `${shortcutPrefix},`, run: openPrefs },
  { label: t("cmd.export_pdf"), shortcut: `${shortcutPrefix}E`, run: exportPdf },
];

const paletteEl = document.getElementById("commandPalette");
const commandQuery = document.getElementById("commandQuery");
const commandResults = document.getElementById("commandResults");
const shortcutsEl = document.getElementById("shortcutsDialog");
let utilityDialogTrigger = null;

function closeUtilityDialog(dialog) {
  if (!dialog || dialog.hidden) return;
  dialog.hidden = true;
  utilityDialogTrigger?.focus?.();
  utilityDialogTrigger = null;
}

function renderCommandResults() {
  const commands = matchingCommands(commandList(), commandQuery?.value || "");
  commandResults?.replaceChildren(...commands.map((command) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-result";
    button.setAttribute("role", "option");
    const label = document.createElement("span");
    label.textContent = command.label;
    const shortcut = document.createElement("kbd");
    shortcut.textContent = command.shortcut;
    button.append(label, shortcut);
    button.addEventListener("click", () => { closeUtilityDialog(paletteEl); command.run(); });
    return button;
  }));
}

function openCommandPalette() {
  utilityDialogTrigger = document.activeElement;
  paletteEl.hidden = false;
  commandQuery.value = "";
  renderCommandResults();
  commandQuery.focus();
}

function openShortcuts() {
  utilityDialogTrigger = document.activeElement;
  const rows = document.getElementById("shortcutRows");
  rows.replaceChildren(...commandList().map((command) => {
    const row = document.createElement("tr");
    const label = document.createElement("td");
    const key = document.createElement("td");
    label.textContent = command.label;
    const kbd = document.createElement("kbd");
    kbd.textContent = command.shortcut;
    key.append(kbd);
    row.append(label, key);
    return row;
  }));
  shortcutsEl.hidden = false;
  shortcutsEl.querySelector("h2")?.setAttribute("tabindex", "-1");
  shortcutsEl.querySelector("h2")?.focus();
}

commandQuery?.addEventListener("input", renderCommandResults);
commandQuery?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commandResults.querySelector("button")?.click();
  }
});
paletteEl?.addEventListener("click", (event) => { if (event.target === paletteEl) closeUtilityDialog(paletteEl); });
shortcutsEl?.addEventListener("click", (event) => { if (event.target === shortcutsEl) closeUtilityDialog(shortcutsEl); });

// La vista previa abre los enlaces web fuera de Luca. En los modos split y
// rendered, pulsar cualquier otro bloque abre su Markdown in situ.
previewsEl.addEventListener("click", async (e) => {
  const link = e.target.closest("a[href]");
  const href = link?.getAttribute("href");
  const webUrl = externalWebUrl(href, window.location.href);
  if (webUrl) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (TAURI?.opener?.openUrl) await TAURI.opener.openUrl(webUrl);
      else window.open(webUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.warn("No se pudo abrir el enlace en el navegador del sistema:", error);
    }
    return;
  }
  if (isInternalAnchor(href)) return;

  const doc = active;
  if (!doc || !isEditablePreviewMode(document.body.dataset.mode)) return;
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
    zenBtn.title = t(on ? "ui.zen.exit" : "ui.zen.title", { key: shortcutPrefix });
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

  const pdfBtn = document.getElementById("pdfBtn");
  if (pdfBtn) {
    pdfBtn.innerHTML = icon("book-down");
    pdfBtn.addEventListener("click", () => exportPdf());
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
// macOS imprime con márgenes reales desde Rust; el resto de plataformas usa el diálogo del webview.
// Los colores de un diagrama Mermaid se hornean en el SVG al renderizarlo: con
// el tema oscuro el papel recibe trazos claros sobre blanco y el diagrama queda
// invisible. Para imprimir se fuerza la paleta clara, se vuelve a renderizar y
// al salir del diálogo se restituye el tema de la pantalla.
let pdfBusy = false;
async function exportPdf() {
  if (!active || pdfBusy) return;
  pdfBusy = true;
  const root = document.documentElement;
  const prevTheme = root.getAttribute("data-theme");
  // Wikitext no lleva Mermaid: no vale un segundo viaje a la wiki por el tema.
  const toLight = isCurrentDark() && active.format !== "wikitext";
  // En macOS los márgenes los pone NSPrintInfo; @page se anula para que no se sumen.
  const st = document.createElement("style");
  st.textContent = "@page { margin:0 }";
  try {
    if (toLight) { root.setAttribute("data-theme", "light"); initMermaid(); }
    await renderDoc(active, true);
    document.head.append(st);
    try { await TAURI.core.invoke("print_with_margins"); } catch { window.print(); }
  } finally {
    st.remove();
    if (toLight) {
      if (prevTheme === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", prevTheme);
      initMermaid();
      renderDoc(active, true);
    }
    pdfBusy = false;
  }
}

// ---------- Sistema de Diseño y Tokens (Vera) ----------
// Las tipografías, medidas y anchos son generales.
// Los colores son por tema (Claro y Oscuro), ambos configurables y soportados.

export const VERA_DEFAULTS = {
  general: {
    "--font-mono": "'IBM Plex Mono', ui-monospace, Menlo, monospace",
    "--font-read": "'IBM Plex Sans', system-ui, sans-serif",
    "--font-body": "'IBM Plex Sans', system-ui, sans-serif",
    "--font-ui": "system-ui, sans-serif",
    "--text-size": "16px",
    "--line-height": "1.8",
    "--content-width": "55em",
    "--code-size": "14px",
    "--code-width": "65em",
  },
  light: {
    "--bg": "#fafffd",
    "--bg-raised": "#f7f6f3",
    "--text": "#463815",
    "--text-dim": "#8f8b74",
    "--code-bg": "#ebebeb",
    "--code-text": "#606060",
    "--preview-bg": "#fbfffb",
    "--preview-text": "#00473b",
    "--rule": "#dcdabf",
    "--accent": "#ad3e00",
  },
  dark: {
    "--bg": "#1b1814",
    "--bg-raised": "#21211c",
    "--text": "#9aa190",
    "--text-dim": "#a4a696",
    "--code-bg": "#11150c",
    "--code-text": "#89917a",
    "--preview-bg": "#1d1d19",
    "--preview-text": "#bbc5a8",
    "--rule": "#1d1d18",
    "--accent": "#d95000",
  },
};

const FONT_STACKS = [
  ["IBM Plex Mono", "'IBM Plex Mono', ui-monospace, Menlo, monospace"],
  ["IBM Plex Sans", "'IBM Plex Sans', system-ui, sans-serif"],
  ["Roboto Serif", "'Roboto Serif', Georgia, serif"],
  ["IBM Plex Serif", "'IBM Plex Serif', Georgia, serif"],
  ["Roboto", "'Roboto', system-ui, sans-serif"],
  ["JetBrains Mono", "'JetBrains Mono', ui-monospace, Menlo, monospace"],
  ["Fira Code", "'Fira Code', ui-monospace, Menlo, monospace"],
  ["Source Serif 4", "'Source Serif 4', Georgia, serif"],
  ["Mono del sistema", "ui-monospace, 'SF Mono', Menlo, monospace"],
  ["Serif del sistema", "Georgia, 'Times New Roman', serif"],
  ["Sans del sistema", "system-ui, sans-serif"],
];

// Código y lectura se ajustan por separado: fuente, tamaño y ancho de columna.
const GENERAL_TOKENS_META = [
  { group: "token.group.code" },
  { name: "--font-mono", label: "token.font", kind: "font" },
  { name: "--code-size", label: "token.text_size", kind: "text" },
  { name: "--code-width", label: "token.column_width", kind: "text" },
  { group: "token.group.read" },
  { name: "--font-read", label: "token.font", kind: "font" },
  { name: "--text-size", label: "token.text_size", kind: "text" },
  { name: "--line-height", label: "token.line_height", kind: "text" },
  { name: "--content-width", label: "token.column_width", kind: "text" },
  { group: "token.group.ui" },
  { name: "--font-body", label: "token.font.body", kind: "font" },
  { name: "--font-ui", label: "token.font.ui", kind: "font" },
];

const COLOR_TOKENS_META = [
  { group: "token.group.app" },
  { name: "--bg", label: "token.bg" },
  { name: "--bg-raised", label: "token.bg_raised" },
  { name: "--text", label: "token.text" },
  { name: "--text-dim", label: "token.text_dim" },
  { name: "--rule", label: "token.rule" },
  { name: "--accent", label: "token.accent" },

  { group: "token.group.editor" },
  { name: "--code-bg", label: "token.code_bg" },
  { name: "--code-text", label: "token.code_text" },

  { group: "token.group.preview" },
  { name: "--preview-bg", label: "token.preview_bg" },
  { name: "--preview-text", label: "token.preview_text" },
];

const KNOWN_SCHEMES = new Set(["system", "light", "dark"]);
const storedScheme = () => {
  try {
    const scheme = localStorage.getItem("luca.scheme");
    return KNOWN_SCHEMES.has(scheme) ? scheme : "system";
  } catch { return "system"; }
};

// Un diseño importado viene de un archivo cualquiera y sus valores se escriben
// dentro de un <style>: sólo se aceptan nombres de token conocidos y valores
// que no puedan cerrar la declaración y colar reglas propias.
const safeTokenValue = (value) =>
  typeof value === "string" && value.length <= 200 && !/[{}<>;]/.test(value);

function normalizeTokenGroup(group, defaults) {
  const out = { ...defaults };
  for (const [key, value] of Object.entries(group || {})) {
    if (key in defaults && safeTokenValue(value)) out[key] = value.trim();
  }
  return out;
}

// Acepta la forma actual (general/light/dark) y la plana antigua, que mezclaba
// todos los tokens en un objeto: el filtro por nombre reparte cada uno.
function normalizeTokens(source) {
  const nested = source?.general || source?.light || source?.dark;
  const flat = source && !nested ? source : null;
  return {
    general: normalizeTokenGroup(flat || source?.general, VERA_DEFAULTS.general),
    light: normalizeTokenGroup(flat || source?.light, VERA_DEFAULTS.light),
    dark: normalizeTokenGroup(flat || source?.dark, VERA_DEFAULTS.dark),
  };
}

function loadTokens(held = localStorage.getItem(TOKENS_KEY)) {
  let parsed = null;
  try { parsed = held ? JSON.parse(held) : null; } catch {}
  if (parsed && typeof parsed !== "object") parsed = null;
  return {
    ...normalizeTokens(parsed),
    scheme: KNOWN_SCHEMES.has(parsed?.scheme) ? parsed.scheme : storedScheme(),
  };
}

// ---------- Diseños: juegos de tokens con nombre ----------
// Un diseño es el estado gráfico completo: tipografías, medidas y los colores
// de ambos temas. El esquema claro/oscuro no viaja con él, es del dispositivo.
const pickTokens = ({ general, light, dark }) => ({
  general: { ...general },
  light: { ...light },
  dark: { ...dark },
});

function loadDesigns() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DESIGNS_KEY) || "null");
    const list = (Array.isArray(parsed?.list) ? parsed.list : [])
      .filter((design) => design && typeof design.name === "string" && design.name.trim())
      .map((design) => ({ name: design.name.trim(), ...normalizeTokens(design) }));
    if (list.length) {
      const active = list.some((design) => design.name === parsed.active) ? parsed.active : list[0].name;
      return { active, list };
    }
  } catch {}
  // Una lista ilegible no puede costarle al autor lo que ajustó: se reconstruye
  // desde luca.tokens, el respaldo plano del diseño activo.
  return { active: DEFAULT_DESIGN_NAME, list: [{ name: DEFAULT_DESIGN_NAME, ...pickTokens(loadTokens()) }] };
}

let designs = loadDesigns();
const activeDesign = () => designs.list.find((design) => design.name === designs.active) || designs.list[0];
const saveDesigns = () => {
  try { localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs)); } catch {}
};

let tokensState = { ...pickTokens(activeDesign()), scheme: storedScheme() };

function isCurrentDark() {
  if (tokensState.scheme === "dark") return true;
  if (tokensState.scheme === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function saveTokens() {
  Object.assign(activeDesign(), pickTokens(tokensState));
  saveDesigns();
  try {
    // Respaldo plano del diseño activo, para el caso de una lista corrupta.
    localStorage.setItem(TOKENS_KEY, JSON.stringify(pickTokens(tokensState)));
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
  refreshWikiScheme();
  for (const d of docs) renderDoc(d);
  updateThemeSwitchUI();
}

const prefsEl = document.getElementById("prefs");
const aboutEl = document.getElementById("about");
const mermaidSel = document.getElementById("mermaidTheme");
const wikiServerSel = document.getElementById("wikiServer");
const wikiTitleInput = document.getElementById("wikiTitle");
const wikiServerNameInput = document.getElementById("wikiServerName");
const wikiServerApiInput = document.getElementById("wikiServerApi");
const wikiStylesInput = document.getElementById("wikiStyles");
const wikiStyleModulesInput = document.getElementById("wikiStyleModules");
const languageSel = document.getElementById("uiLanguage");
const cliStateEl = document.getElementById("cliState");
const cliDirSel = document.getElementById("cliDir");
const cliWhereRow = document.getElementById("cliWhereRow");
const cliInstallBtn = document.getElementById("cliInstall");
const cliRemoveBtn = document.getElementById("cliRemove");
const designListEl = document.getElementById("designList");
const designNameInput = document.getElementById("designName");
const tokenFormGeneral = document.getElementById("tokenFormGeneral");
const tokenFormLight = document.getElementById("tokenFormLight");
const tokenFormDark = document.getElementById("tokenFormDark");

function buildTokenForms() {
  // 1. Formulario General (Tipografía y Medida)
  if (tokenFormGeneral) {
    tokenFormGeneral.replaceChildren();
    for (const meta of GENERAL_TOKENS_META) {
      if (meta.group) {
        const g = document.createElement("div");
        g.className = "prefs-group";
        g.textContent = t(meta.group);
        tokenFormGeneral.append(g);
        continue;
      }
      const row = document.createElement("div");
      row.className = "prefs-row";
      const span = document.createElement("span");
      span.textContent = t(meta.label);
      row.append(span);

      let input;
      if (meta.kind === "font") {
        input = document.createElement("select");
        const curVal = tokensState.general[meta.name] ?? VERA_DEFAULTS.general[meta.name];
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
          opt.textContent = t("prefs.font.custom");
          opt.selected = true;
          input.prepend(opt);
        }
        input.addEventListener("change", () => {
          tokensState.general[meta.name] = input.value;
          saveTokens();
          applyTokens();
          refreshSamples();
        });
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = tokensState.general[meta.name] ?? VERA_DEFAULTS.general[meta.name];
        input.addEventListener("change", () => {
          tokensState.general[meta.name] = input.value.trim();
          saveTokens();
          applyTokens();
          refreshSamples();
        });
      }
      row.append(input);
      tokenFormGeneral.append(row);
    }
  }

  // Helper para construir sección de colores
  // La muestra lleva los tokens puestos en su propia raíz: los generales de la
  // pestaña Generales —tipografías, cuerpos, interlínea, medidas— y los colores
  // del tema que se edita. Al no heredar los de la app, enseña el tema oscuro
  // tal como se verá aunque estés mirando la pantalla en claro.
  function themeSample(themeKey) {
    const sample = document.createElement("div");
    sample.className = "theme-sample";
    const token = (name) =>
      tokensState.general[name] ?? tokensState[themeKey][name] ??
      VERA_DEFAULTS.general[name] ?? VERA_DEFAULTS[themeKey][name];
    for (const name of [...Object.keys(VERA_DEFAULTS.general), ...Object.keys(VERA_DEFAULTS[themeKey])]) {
      sample.style.setProperty(name, token(name));
    }

    const code = document.createElement("div");
    code.className = "sample-code";
    const l1 = document.createElement("div");
    l1.className = "accent";
    l1.textContent = t("sample.code.comment");
    const l2 = document.createElement("div");
    l2.textContent = t("sample.code.text");
    code.append(l1, l2);

    const read = document.createElement("div");
    read.className = "sample-read";
    const h = document.createElement("h4");
    h.textContent = t("sample.read.heading");
    const p = document.createElement("p");
    p.append(document.createTextNode(`${t("sample.read.text")} `));
    const a = document.createElement("span");
    a.className = "accent";
    a.textContent = t("sample.read.link");
    p.append(a, document.createTextNode("."));
    const rule = document.createElement("hr");
    const dim = document.createElement("p");
    dim.className = "dim";
    dim.textContent = t("sample.read.dim");
    // Los colores de la interfaz no tienen dónde verse en un texto: van como
    // una franja, que es la única manera honesta de mostrarlos.
    const chrome = document.createElement("div");
    chrome.className = "chrome";
    for (const name of ["--bg", "--bg-raised", "--rule", "--text", "--text-dim"]) {
      const swatch = document.createElement("span");
      swatch.style.background = `var(${name})`;
      swatch.title = name;
      chrome.append(swatch);
    }
    read.append(h, p, rule, dim, chrome);

    sample.append(code, read);
    return sample;
  }

  // Las muestras de los dos temas llevan los tokens generales, así que cambiar
  // una tipografía o un cuerpo en Generales también las desactualiza.
  function refreshSamples() {
    for (const [container, themeKey] of [[tokenFormLight, "light"], [tokenFormDark, "dark"]]) {
      const live = container?.querySelector(".theme-sample");
      if (live) live.replaceWith(themeSample(themeKey));
    }
  }

  function buildColorSection(container, themeKey) {
    if (!container) return;
    container.replaceChildren();
    container.append(themeSample(themeKey));

    const note = document.createElement("div");
    note.className = "prefs-group";
    note.textContent = t("prefs.palette.note", { theme: t(`prefs.theme.${themeKey}`) });
    container.append(note);

    for (const meta of COLOR_TOKENS_META) {
      if (meta.group) {
        const g = document.createElement("div");
        g.className = "prefs-group";
        g.textContent = t(meta.group);
        container.append(g);
        continue;
      }
      const row = document.createElement("div");
      row.className = "prefs-row";
      const label = document.createElement("span");
      label.textContent = t(meta.label);
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
        // Repintar sólo la muestra: reconstruir el formulario entero robaría el
        // foco del control que se está arrastrando.
        refreshSamples();
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

}

// ---------- El comando `luca` en la terminal ----------
// Rust dice en qué estado está y en qué carpetas del PATH puede escribir; aquí
// sólo se decide qué se muestra. Un `luca` que no sea nuestro no se toca.
async function refreshCliState() {
  if (!cliStateEl) return;
  let report = null;
  if (TAURI) {
    try { report = await TAURI.core.invoke("cli_link_status"); } catch {}
  }
  const state = report?.state ?? "no_candidates";
  const path = report?.path ?? "";
  const dirs = report?.candidates ?? [];

  cliStateEl.innerHTML = t(`prefs.cli.${state === "no_candidates" ? "none" : state}`, { path });
  if (cliDirSel) {
    cliDirSel.replaceChildren(...dirs.map((dir) => {
      const option = document.createElement("option");
      option.value = dir;
      option.textContent = dir;
      return option;
    }));
  }
  // Ofrecer instalar sólo cuando hay sitio y no hay nada; quitar sólo lo nuestro.
  const puedeInstalar = state === "missing" && dirs.length > 0;
  if (cliWhereRow) cliWhereRow.hidden = !puedeInstalar;
  if (cliInstallBtn) cliInstallBtn.hidden = !puedeInstalar;
  if (cliRemoveBtn) cliRemoveBtn.hidden = state !== "linked";
}

async function installCliLink() {
  try {
    await TAURI.core.invoke("install_cli_link", { dir: cliDirSel?.value });
  } catch (error) {
    alert(t(error));
  }
  refreshCliState();
}

async function removeCliLink() {
  try {
    await TAURI.core.invoke("remove_cli_link");
  } catch (error) {
    alert(t(error));
  }
  refreshCliState();
}

// Menú lateral de categorías: una sección visible a la vez.
function showPrefsTab(name) {
  for (const btn of document.querySelectorAll(".prefs-tab-btn")) {
    btn.classList.toggle("active", btn.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll("[data-tab-panel]")) {
    panel.hidden = panel.dataset.tabPanel !== name;
  }
}
document.querySelectorAll(".prefs-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => showPrefsTab(btn.dataset.tab));
});

// Lista de wikis: el select nombra lo guardado y marca la activa.
function fillWikiServers() {
  if (!wikiServerSel) return;
  const current = wikiApi();
  wikiServerSel.replaceChildren(...wikiServers().map((server) => {
    const option = document.createElement("option");
    option.value = server.api;
    option.textContent = t("prefs.wiki.server.option", { name: server.name, api: server.api });
    option.selected = server.api === current;
    return option;
  }));
  if (!wikiServers().some((server) => server.api === current)) {
    const option = document.createElement("option");
    option.value = current;
    option.textContent = t("prefs.wiki.server.option", { name: wikiServerLabel(current), api: current });
    option.selected = true;
    wikiServerSel.prepend(option);
  }
}

const rerenderWikitext = () => {
  for (const d of docs.filter((candidate) => candidate.format === "wikitext")) renderDoc(d, true);
};

function setWikiApi(api) {
  try { localStorage.setItem(WIKI_API_KEY, api); } catch {}
  fillWikiServers();
  if (active) updateWikiStatus(active);
  rerenderWikitext();
}

function openPrefs(tab) {
  if (mermaidSel) mermaidSel.value = mermaidTheme();
  fillWikiServers();
  if (wikiTitleInput) {
    try { wikiTitleInput.value = localStorage.getItem("luca.wikiTitle") || ""; } catch {}
  }
  if (wikiStylesInput) wikiStylesInput.checked = wikiStylesOn();
  if (wikiStyleModulesInput) {
    try { wikiStyleModulesInput.value = localStorage.getItem(WIKI_STYLE_MODULES_KEY) || ""; } catch {}
  }
  buildTokenForms();
  renderDesignList();
  refreshCliState();
  if (typeof tab === "string") showPrefsTab(tab);
  utilityDialogTrigger = document.activeElement;
  if (prefsEl) {
    prefsEl.hidden = false;
    document.getElementById("prefsBack")?.focus();
  }
}

function closePrefs() {
  closeUtilityDialog(prefsEl);
  active?.ed.remeasure?.();
}

async function openAbout() {
  if (!aboutEl) return;
  utilityDialogTrigger = document.activeElement;
  try {
    const version = await TAURI?.app?.getVersion?.();
    if (version) document.getElementById("aboutVersion").textContent = t("about.version", { version });
  } catch {}
  aboutEl.hidden = false;
  document.getElementById("aboutClose")?.focus();
}

function closeAbout() {
  closeUtilityDialog(aboutEl);
}

document.getElementById("aboutClose")?.addEventListener("click", closeAbout);
aboutEl?.addEventListener("click", (e) => { if (e.target === aboutEl) closeAbout(); });
aboutEl?.querySelectorAll("[data-external]").forEach((link) => {
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    try { await TAURI?.opener?.openUrl?.(link.href); } catch {}
  });
});

// La lista es la que dice cuál se está editando: la fila activa se marca y un
// clic cambia de diseño sin tocar el esquema claro/oscuro del dispositivo.
function renderDesignList() {
  if (!designListEl) return;
  designListEl.replaceChildren(...designs.list.map((design) => {
    const row = document.createElement("button");
    row.type = "button";
    row.role = "option";
    row.textContent = design.name;
    row.ariaSelected = design.name === designs.active ? "true" : "false";
    row.addEventListener("click", () => selectDesign(design.name));
    return row;
  }));
  if (designNameInput) designNameInput.value = designs.active;
}

function useActiveDesign() {
  tokensState = { ...pickTokens(activeDesign()), scheme: tokensState.scheme };
  saveTokens();
  applyTokens();
  buildTokenForms();
  renderDesignList();
}

function selectDesign(name) {
  if (name === designs.active) return;
  designs.active = name;
  useActiveDesign();
}

// Nuevo parte de los valores de fábrica; duplicar copia el diseño actual. En
// los dos casos el diseño nuevo queda activo, que es lo que se espera al crearlo.
function addDesign(tokens, name) {
  const unique = uniqueDesignName(designs.list.map((design) => design.name), name);
  designs.list.push({ name: unique, ...pickTokens(tokens) });
  designs.active = unique;
  useActiveDesign();
}

async function removeDesign() {
  if (designs.list.length < 2) {
    alert(t("dialog.design.last"));
    return;
  }
  const current = activeDesign();
  if (!(await confirm(t("dialog.design.remove", { name: current.name })))) return;
  designs.list = designs.list.filter((design) => design !== current);
  designs.active = designs.list[0].name;
  useActiveDesign();
}

function renameDesign(wanted) {
  const current = activeDesign();
  const unique = uniqueDesignName(designs.list.map((design) => design.name), wanted, { exclude: current.name });
  current.name = unique;
  designs.active = unique;
  saveDesigns();
  renderDesignList();
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

// Exportar/importar un diseño como JSON: tipografías, medidas y los colores de
// ambos temas, con su nombre. El esquema claro/oscuro es una preferencia del
// dispositivo y no viaja con el archivo.
const TOKENS_FILTER = () => [{ name: t("dialog.filter.design"), extensions: ["json"] }];
const DIAGNOSTIC_FILTER = () => [{ name: t("dialog.filter.diagnostic"), extensions: ["json"] }];

async function exportTokens() {
  const design = activeDesign();
  const slug = design.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();
  const path = await TAURI.dialog.save({
    defaultPath: `luca-diseno-${slug || "sin-nombre"}.json`,
    filters: TOKENS_FILTER(),
  });
  if (!path) return;
  const contents = JSON.stringify({ name: design.name, ...pickTokens(tokensState) }, null, 2);
  await TAURI.core.invoke("write_file", { path, contents: `${contents}\n` });
}

async function importTokens() {
  const path = await TAURI.dialog.open({ filters: TOKENS_FILTER() });
  if (typeof path !== "string") return;
  const text = await TAURI.core.invoke("read_file", { path });
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (!parsed || typeof parsed !== "object") { alert(t("dialog.design.invalid")); return; }
  // Importar añade un diseño a la lista: nunca pisa el que se está usando.
  // normalizeTokens completa con los valores de fábrica y descarta lo que no
  // sea un token conocido, venga el archivo con la forma nueva o la plana.
  const fallback = baseName(path).replace(/\.json$/i, "");
  addDesign(normalizeTokens(parsed), typeof parsed.name === "string" ? parsed.name : fallback);
}

async function exportDiagnostic() {
  const path = await TAURI.dialog.save({ defaultPath: "luca-diagnostico.json", filters: DIAGNOSTIC_FILTER() });
  if (!path) return;
  let version = "desconocida";
  try { version = await TAURI?.app?.getVersion?.() || version; } catch {}
  const report = diagnosticReport({
    version,
    platform: navigator.userAgentData?.platform || navigator.platform,
    windowLabel,
    activeFormat: active?.format,
    documents: docs,
  });
  await TAURI.core.invoke("write_file", { path, contents: `${JSON.stringify(report, null, 2)}\n` });
}

if (prefsEl) {
  document.getElementById("prefsBack")?.addEventListener("click", closePrefs);
  document.getElementById("prefsReset")?.addEventListener("click", resetTokens);
  document.getElementById("prefsExport")?.addEventListener("click", exportTokens);
  document.getElementById("prefsImport")?.addEventListener("click", importTokens);
  document.getElementById("prefsDiagnostic")?.addEventListener("click", exportDiagnostic);
  document.getElementById("designAdd")?.addEventListener("click", () => addDesign(VERA_DEFAULTS, t("prefs.design.new_name")));
  document.getElementById("designDuplicate")?.addEventListener("click", () => addDesign(tokensState, t("prefs.design.copy_suffix", { name: designs.active })));
  document.getElementById("designRemove")?.addEventListener("click", removeDesign);
  cliInstallBtn?.addEventListener("click", installCliLink);
  cliRemoveBtn?.addEventListener("click", removeCliLink);
  designNameInput?.addEventListener("change", () => renameDesign(designNameInput.value));
  mermaidSel?.addEventListener("change", () => {
    try { localStorage.setItem("luca.mermaidTheme", mermaidSel.value); } catch {}
    initMermaid();
    for (const d of docs) renderDoc(d);
  });
  languageSel?.addEventListener("change", () => {
    try { localStorage.setItem(LANG_KEY, languageSel.value); } catch {}
    setLanguage(resolveLanguage(languageSel.value));
    applyLanguage();
    // Los documentos Markdown no llevan rótulos, pero la vista previa Wikitext
    // muestra su estado traducido: se repinta con el idioma nuevo.
    if (active) updateWikiStatus(active);
  });
  wikiServerSel?.addEventListener("change", () => setWikiApi(wikiServerSel.value));
  wikiServerApiInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") addWikiServer(); });
  document.getElementById("wikiServerAdd")?.addEventListener("click", addWikiServer);
  document.getElementById("wikiServerRemove")?.addEventListener("click", removeWikiServer);
  wikiTitleInput?.addEventListener("change", () => {
    try {
      const value = wikiTitleInput.value.trim();
      if (value) localStorage.setItem("luca.wikiTitle", value);
      else localStorage.removeItem("luca.wikiTitle");
    } catch {}
    rerenderWikitext();
  });
  wikiStylesInput?.addEventListener("change", () => {
    try { localStorage.setItem(WIKI_STYLES_KEY, wikiStylesInput.checked ? "on" : "off"); } catch {}
    rerenderWikitext();
  });
  wikiStyleModulesInput?.addEventListener("change", () => {
    try { localStorage.setItem(WIKI_STYLE_MODULES_KEY, wikiStyleModulesInput.value.trim()); } catch {}
    wikiStyleSheets.clear();
    rerenderWikitext();
  });
}

// Guardar una wiki: nombre libre y endpoint api.php por HTTPS. Pasa a ser la
// activa; si ya estaba, se actualiza su nombre.
function addWikiServer() {
  const api = (wikiServerApiInput?.value || "").trim();
  let url;
  try { url = new URL(api); } catch { url = null; }
  if (!url || url.protocol !== "https:") {
    alert(t("dialog.wiki.invalid"));
    return;
  }
  const name = (wikiServerNameInput?.value || "").trim() || url.host;
  const list = wikiServers().filter((server) => server.api !== url.href);
  list.push({ name, api: url.href });
  saveWikiServers(list);
  if (wikiServerNameInput) wikiServerNameInput.value = "";
  if (wikiServerApiInput) wikiServerApiInput.value = "";
  setWikiApi(url.href);
}

function removeWikiServer() {
  const current = wikiApi();
  const list = wikiServers().filter((server) => server.api !== current);
  if (!list.length) {
    alert(t("dialog.wiki.last"));
    return;
  }
  saveWikiServers(list);
  setWikiApi(list[0].api);
}

// ⌘, abre Preferencias (macOS y web)
addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === ",") {
    e.preventDefault();
    openPrefs();
  }
});

// El idioma se aplica a lo que ya está en el DOM y al menú nativo, que Rust
// arma con estas etiquetas. Lo que se dibuja después (pestañas, esquema,
// formularios, paleta) ya se construye traducido.
function applyLanguage() {
  document.documentElement.lang = language();
  translatePage(document, { key: shortcutPrefix });
  // Rehacer el menú lo deja con su submenú de recientes vacío: se repuebla.
  TAURI?.core.invoke("set_menu_labels", { labels: menuLabels() })
    .then(renderRecentFiles)
    .catch(() => {});
  if (languageSel) languageSel.value = storedLanguage();
  renderTabs();
  if (active) {
    updateFormatControls(active);
    updateCursorStatus(active);
    for (const d of docs) {
      d.editorEl.setAttribute("aria-label", t("ui.editor_of", { name: baseName(d.path) }));
      d.previewEl.setAttribute("aria-label", t("ui.preview_of", { name: baseName(d.path) }));
    }
  }
  buildTokenForms();
  renderDesignList();
}

applyTokens();
applyLanguage();

// Esc cierra preferencias si están abiertas, o sale del zen si está activo
addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (paletteEl && !paletteEl.hidden) { e.preventDefault(); closeUtilityDialog(paletteEl); return; }
    if (shortcutsEl && !shortcutsEl.hidden) { e.preventDefault(); closeUtilityDialog(shortcutsEl); return; }
    if (prefsEl && !prefsEl.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closePrefs();
      return;
    }
    if (aboutEl && !aboutEl.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closeAbout();
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

const SAMPLE = `# Luca

> *«Una manera de entender la escritura desde su forma, sus proporciones y el cuidado de sus trazos.»*  
> — Fra Luca Pacioli, *Divina proportione* (1509)

Luca es un editor Markdown local del ecosistema **MediaFranca**, diseñado para elaborar textos claros y estructurados antes de su publicación en [[Vera]]. Combina un núcleo nativo en **Tauri 2** y Rust con un entorno de edición rápido en **CodeMirror 6** y soporte integral para **Mermaid 12 offline**.

---

## Flujo de Trabajo

El siguiente diagrama ilustra la arquitectura de creación, verificación y publicación soberana:

\`\`\`mermaid
flowchart LR
    A["Borrador local
(Markdown en Luca)"] --> B["Edición y Tablas
(CM6 + Editor Vera)"]
    B --> C["Vista Previa
(marked + Mermaid 12)"]
    C --> D["Guardado atómico
(Archivo .md en disco)"]
    D --> E["Publicación
(Ecosistema Vera)"]
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
- [x] Tokens y temas independientes (Claro y Oscuro de Vera), exportables e importables como JSON
- [x] Tipografía y ancho de columna independientes para código y lectura
- [x] Guardado atómico en disco con detección de cambios externos por mtime
- [x] Edición por bloques directamente sobre la vista previa (*WYSIWYG*)
- [x] Imágenes y recursos locales por ruta relativa al documento
- [x] Exportación a PDF con márgenes de página
- [x] Apertura de archivos \`.md\` desde Vera y el sistema en macOS, Linux y Windows

### Próximos pasos
- [ ] Resaltado de sintaxis enriquecido dentro de bloques Mermaid
- [ ] Paquetes de iconos vectoriales adicionales para diagramas
`;

// Esperar a que las fuentes carguen ANTES de montar el editor, para que
// CodeMirror mida las líneas con Plex Mono y no queden desalineadas.
if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }

// Arranque: si Vera/Finder lanzaron Luca con un archivo, ábrelo; si no, el ejemplo.
async function drainLaunchRequest() {
  if (!TAURI) return false;
  const pending = await TAURI.core.invoke("take_opened_files");
  const pendingNew = await TAURI.core.invoke("take_new_document");
  if (pendingNew) newDoc();
  for (const path of pending ?? []) await openPath(path);
  return pendingNew || Boolean(pending?.length);
}

async function restorePreviousSession() {
  const snapshot = readJsonStorage(sessionStorageKey, null);
  if (!validSession(snapshot) || snapshot.documents.length === 0) return false;
  restoringSession = true;
  const restored = [];
  for (const item of snapshot.documents) {
    try {
      let content = item.content;
      if (content === null && item.path && TAURI) content = await TAURI.core.invoke("read_file", { path: item.path });
      if (typeof content !== "string") continue;
      const doc = makeDoc(content, item.path, item.formatSelection || "auto");
      doc.dirty = Boolean(item.dirty && item.content !== null);
      if (item.path && TAURI) doc.lastMtime = await TAURI.core.invoke("stat", { path: item.path });
      if (item.path && TAURI) {
        const owner = await TAURI.core.invoke("claim_document", { path: item.path, windowLabel });
        if (owner) {
          await closeDoc(doc, { force: true, release: false, replacement: false });
          continue;
        }
      }
      restored.push(doc);
    } catch {}
  }
  restoringSession = false;
  if (!restored.length) return false;
  activate(restored[Math.min(snapshot.activeIndex || 0, restored.length - 1)]);
  renderTabs();
  saveSessionSoon();
  return true;
}

addEventListener("beforeunload", (event) => {
  saveSessionNow();
  if (docs.some((doc) => doc.dirty)) {
    event.preventDefault();
    event.returnValue = "";
  }
});

renderRecentFiles();
if (windowLabel === "main") {
  if (!(await drainLaunchRequest()) && !(await restorePreviousSession())) makeDoc(SAMPLE, null);
} else {
  await receiveTransferredTabs();
  if (!docs.length) newDoc();
}
