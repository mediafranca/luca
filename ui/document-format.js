export const FORMATS = new Set(["markdown", "wikitext", "text"]);
export const FORMAT_SELECTIONS = new Set(["auto", ...FORMATS]);

export function inferredFormat(path, fallback = "markdown") {
  const clean = String(path ?? "").split(/[?#]/, 1)[0].toLowerCase();
  if (clean.endsWith(".wiki") || clean.endsWith(".wikitext")) return "wikitext";
  if (clean.endsWith(".md") || clean.endsWith(".markdown")) return "markdown";
  if (clean.endsWith(".txt")) return "text";
  return FORMATS.has(fallback) ? fallback : "markdown";
}

export function interpretedFormat(path, selection = "auto", fallback = "markdown") {
  return FORMATS.has(selection) ? selection : inferredFormat(path, fallback);
}

export function extensionMismatch(path, selection) {
  if (!path || selection === "auto") return false;
  const inferred = inferredFormat(path, null);
  const hasKnownExtension = /\.(?:md|markdown|wiki|wikitext|txt)$/i.test(path);
  return hasKnownExtension && inferred !== selection;
}
