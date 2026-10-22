export const SETTINGS_SCHEMA_VERSION = 2;
export const SETTINGS_SCHEMA_KEY = "luca.settingsSchema";
export const DESIGNS_KEY = "luca.designs";
export const TOKENS_KEY = "luca.tokens";
export const DEFAULT_DESIGN_NAME = "Vera";

const knownSchemes = new Set(["system", "light", "dark"]);
const knownFormats = new Set(["markdown", "wikitext"]);

export function migrateSettings(storage) {
  const previous = Number.parseInt(storage.getItem(SETTINGS_SCHEMA_KEY) || "0", 10) || 0;
  if (previous >= SETTINGS_SCHEMA_VERSION) return { from: previous, to: previous, changed: false };

  if (previous < 1) {
    const scheme = storage.getItem("luca.scheme");
    if (scheme && !knownSchemes.has(scheme)) storage.setItem("luca.scheme", "system");
    const format = storage.getItem("luca.newDocumentFormat");
    if (format && !knownFormats.has(format)) storage.setItem("luca.newDocumentFormat", "markdown");
    const legacySession = storage.getItem("luca.session.v1") || storage.getItem("luca.session");
    if (legacySession && !storage.getItem("luca.session.v1.main")) {
      storage.setItem("luca.session.v1.main", legacySession);
    }
  }

  if (previous < 2) {
    // Los tokens dejan de ser un juego único y pasan a ser una lista de
    // diseños con nombre. Lo que ya estaba configurado se convierte en el
    // primer diseño; luca.tokens se conserva como respaldo de lectura.
    if (!storage.getItem(DESIGNS_KEY)) {
      storage.setItem(DESIGNS_KEY, JSON.stringify({
        active: DEFAULT_DESIGN_NAME,
        list: [{ name: DEFAULT_DESIGN_NAME, ...readLegacyTokens(storage) }],
      }));
    }
  }

  storage.setItem(SETTINGS_SCHEMA_KEY, String(SETTINGS_SCHEMA_VERSION));
  return { from: previous, to: SETTINGS_SCHEMA_VERSION, changed: true };
}

export function diagnosticReport({ version, platform, documents, activeFormat, windowLabel }) {
  const open = Array.isArray(documents) ? documents : [];
  return {
    product: "Luca",
    version: version || "desconocida",
    platform: platform || "desconocida",
    settingsSchema: SETTINGS_SCHEMA_VERSION,
    window: windowLabel === "main" ? "principal" : "secundaria",
    documents: {
      open: open.length,
      dirty: open.filter((doc) => doc?.dirty).length,
      markdown: open.filter((doc) => doc?.format === "markdown").length,
      wikitext: open.filter((doc) => doc?.format === "wikitext").length,
      activeFormat: activeFormat || null,
    },
    capabilities: {
      localEditing: true,
      offlineMarkdownPreview: true,
      mediaWikiPreview: "red explícita",
      browserSessionsReused: false,
    },
  };
}

// El formato plano antiquísimo mezclaba todos los tokens en un solo objeto sin
// distinguir general/claro/oscuro. Quien normaliza es loadTokens en app.js, que
// conoce los nombres válidos: aquí sólo se reparte lo que haya sin perder nada.
function readLegacyTokens(storage) {
  let parsed = null;
  try { parsed = JSON.parse(storage.getItem(TOKENS_KEY) || "null"); } catch {}
  if (!parsed || typeof parsed !== "object") return { general: {}, light: {}, dark: {} };
  if (parsed.general || parsed.light || parsed.dark) {
    return {
      general: parsed.general || {},
      light: parsed.light || {},
      dark: parsed.dark || {},
    };
  }
  return { general: parsed, light: parsed, dark: parsed };
}

// Dos diseños con el mismo nombre serían indistinguibles en la lista: el
// repetido se numera, como hace el Finder. `exclude` deja renombrar un diseño
// sin que choque consigo mismo.
export function uniqueDesignName(existing, wanted, { exclude } = {}) {
  const taken = new Set((existing || []).filter((name) => name !== exclude));
  const base = String(wanted ?? "").trim() || DEFAULT_DESIGN_NAME;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}
