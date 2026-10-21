export function externalWebUrl(href, base = "https://luca.invalid/") {
  const raw = href?.trim();
  if (!raw || raw.startsWith("#")) return null;
  if (!/^(https?:)?\/\//i.test(raw)) return null;

  try {
    const url = new URL(raw, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function isInternalAnchor(href) {
  return Boolean(href?.trim().startsWith("#"));
}

export function isEditablePreviewMode(mode) {
  return mode === "split" || mode === "rendered";
}
