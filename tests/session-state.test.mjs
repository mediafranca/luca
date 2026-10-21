import test from "node:test";
import assert from "node:assert/strict";
import { MAX_RECOVERY_CHARS, recentPaths, sessionSnapshot, validSession } from "../ui/session-state.js";

test("recientes deduplica y lleva la ruta usada al comienzo", () => {
  assert.deepEqual(recentPaths(["b.md", "a.md"], "a.md"), ["a.md", "b.md"]);
});

test("la sesión guarda contenido sólo para recuperación, nunca copias limpias", () => {
  const snapshot = sessionSnapshot([
    { id: 1, path: "/a.md", dirty: false, content: "disco", formatSelection: "auto" },
    { id: 2, path: "/b.wiki", dirty: true, content: "borrador", formatSelection: "wikitext" },
  ], 2);
  assert.equal(snapshot.documents[0].content, null);
  assert.equal(snapshot.documents[1].content, "borrador");
  assert.equal(snapshot.activeIndex, 1);
  assert.equal(validSession(snapshot), true);
});

test("un borrador mayor que el límite no se duplica en almacenamiento local", () => {
  const snapshot = sessionSnapshot([
    { id: 1, path: null, dirty: true, content: "x".repeat(MAX_RECOVERY_CHARS + 1), formatSelection: "markdown" },
  ], 1);
  assert.equal(snapshot.documents[0].content, null);
});
