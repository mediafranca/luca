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
    })),
  };
}

export function validSession(value) {
  return Boolean(value && value.version === 1 && Array.isArray(value.documents));
}
