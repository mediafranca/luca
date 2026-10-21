import test from "node:test";
import assert from "node:assert/strict";
import { isDisposableBlank, transferableTab } from "../ui/window-transfer.js";

test("la transferencia conserva todo el estado editorial observable", () => {
  const editorState = { doc: "borrador", selection: { ranges: [{ anchor: 3, head: 7 }] }, history: { done: [1] } };
  const payload = transferableTab({
    path: "/texto.wiki",
    dirty: true,
    lastMtime: 42,
    formatSelection: "wikitext",
    lineEnding: "CRLF",
    ed: { serialize: () => editorState, getScroll: () => ({ top: 90, left: 2 }) },
  }, "rendered");
  assert.deepEqual(payload, {
    path: "/texto.wiki",
    dirty: true,
    lastMtime: 42,
    formatSelection: "wikitext",
    lineEnding: "CRLF",
    editorState,
    scroll: { top: 90, left: 2 },
    mode: "rendered",
  });
});

test("sólo la pestaña inicial completamente vacía se puede reemplazar", () => {
  assert.equal(isDisposableBlank({ path: null, dirty: false, ed: { getDoc: () => "" } }), true);
  assert.equal(isDisposableBlank({ path: null, dirty: true, ed: { getDoc: () => "" } }), false);
  assert.equal(isDisposableBlank({ path: null, dirty: false, ed: { getDoc: () => "texto" } }), false);
});
