export const FORMAT_SELECTIONS = new Set(["auto", "markdown", "wikitext"]);

export function inferredFormat(path, fallback = "markdown") {
  const clean = String(path ?? "").split(/[?#]/, 1)[0].toLowerCase();
  if (clean.endsWith(".wiki") || clean.endsWith(".wikitext")) return "wikitext";
  if (clean.endsWith(".md") || clean.endsWith(".markdown")) return "markdown";
  return fallback === "wikitext" ? "wikitext" : "markdown";
}

export function interpretedFormat(path, selection = "auto", fallback = "markdown") {
  return selection === "wikitext" ? "wikitext" : selection === "markdown" ? "markdown" : inferredFormat(path, fallback);
}

export function extensionMismatch(path, selection) {
  if (!path || selection === "auto") return false;
  const inferred = inferredFormat(path, null);
  const hasKnownExtension = /\.(?:md|markdown|wiki|wikitext)$/i.test(path);
  return hasKnownExtension && inferred !== selection;
}
