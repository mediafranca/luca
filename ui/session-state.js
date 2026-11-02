export const MAX_RECENT_FILES = 20;
export const MAX_RECOVERY_CHARS = 2_000_000;

export function recentPaths(current, path, limit = MAX_RECENT_FILES) {
  if (!path) return current.slice(0, limit);
  return [path, ...current.filter((item) => item !== path)].slice(0, limit);
}

export function sessionSnapshot(documents, activeId) {
  return {
    version: 1,
    activeIndex: Math.max(0, documents.findIndex((doc) => doc.id === activeId)),
    documents: documents.map((doc) => ({
      path: doc.path,
      dirty: Boolean(doc.dirty),
      content: (!doc.path || doc.dirty) && doc.content.length <= MAX_RECOVERY_CHARS ? doc.content : null,
      formatSelection: doc.formatSelection,
      lastMtime: doc.path ? doc.lastMtime ?? null : null,
    })),
  };
}

// Un borrador restaurado debe compararse con el disco tal como estaba cuando
// se leyó, no al restaurar: si no, una edición externa hecha con Luca cerrada
// se pisaría sin aviso al guardar. Una sesión antigua sin mtime fuerza el aviso
// (0 nunca coincide). Un documento limpio se relee del disco: vale el actual.
export function restoredMtime(item, current) {
  if (!item.dirty || item.content === null) return current;
  return typeof item.lastMtime === "number" ? item.lastMtime : 0;
}

export function validSession(value) {
  return Boolean(value && value.version === 1 && Array.isArray(value.documents));
}
