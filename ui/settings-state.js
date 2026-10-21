export const SETTINGS_SCHEMA_VERSION = 1;
export const SETTINGS_SCHEMA_KEY = "luca.settingsSchema";

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
