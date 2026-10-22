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

// La hoja de la wiki se aplica dentro de un shadow root, donde no hay
// documento: html, :root y body no casan con nada. La wiki cuelga de ahí sus
// variables (Stella Nova define sus tokens --sn-* en :root), así que sin
// reescribir esos selectores la hoja llega entera y no pinta nada.
// `:where(:root[...])` queda fuera a propósito: depende de atributos del
// elemento raíz que la vista previa no reproduce.
export function scopeWikiCss(css) {
  return css
    .replace(WIKI_FONT_FACE, "")
    .replace(/(^|[\s,{}>+~])(?::root|html)\b/g, "$1:host")
    .replace(/(^|[\s,{}>+~])body\b/g, "$1.wiki-body");
}

// Un @font-face declarado dentro de un shadow root no se registra, así que el
// de la wiki no sirve de nada; y su archivo tampoco se descargaría (la vista
// previa sólo trae CSS). Se quita para no dejar reglas inertes ni intentos de
// red en la consola. Las familias siguen resolviendo: un @font-face del
// documento sí alcanza al shadow root, y Luca empaqueta IBM Plex Sans, IBM
// Plex Mono y Roboto Serif, que son justo las que pide Stella Nova. Una
// familia que Luca no tenga cae en la pila que nombra la propia wiki
// (system-ui, Palatino, Georgia…), es decir, en las del sistema.
const WIKI_FONT_FACE = /@font-face\s*\{[^{}]*\}/g;
