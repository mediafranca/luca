export function transferableTab(doc, mode) {
  return {
    path: doc.path,
    dirty: doc.dirty,
    lastMtime: doc.lastMtime,
    formatSelection: doc.formatSelection,
    lineEnding: doc.lineEnding,
    editorState: doc.ed.serialize(),
    scroll: doc.ed.getScroll(),
    mode,
  };
}

export function isDisposableBlank(doc) {
  return Boolean(doc) && !doc.path && !doc.dirty && doc.ed.getDoc() === "";
}
