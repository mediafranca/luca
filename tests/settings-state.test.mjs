import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticReport, migrateSettings, SETTINGS_SCHEMA_VERSION } from "../ui/settings-state.js";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("migra preferencias antiguas sin borrar claves desconocidas", () => {
  const storage = memoryStorage({
    "luca.session.v1": '{"documents":[]}',
    "luca.scheme": "sepia",
    "plugin.future": "se conserva",
  });
  assert.deepEqual(migrateSettings(storage), { from: 0, to: SETTINGS_SCHEMA_VERSION, changed: true });
  assert.equal(storage.getItem("luca.scheme"), "system");
  assert.equal(storage.getItem("luca.session.v1.main"), '{"documents":[]}');
  assert.equal(storage.getItem("plugin.future"), "se conserva");
});

test("la migración es idempotente", () => {
  const storage = memoryStorage({ "luca.settingsSchema": String(SETTINGS_SCHEMA_VERSION) });
  assert.equal(migrateSettings(storage).changed, false);
});

test("el diagnóstico sólo expone conteos y no contenido ni rutas", () => {
  const report = diagnosticReport({
    version: "1.0.0", platform: "linux", windowLabel: "main", activeFormat: "wikitext",
    documents: [
      { path: "/privado/uno.md", content: "secreto", dirty: true, format: "markdown" },
      { path: "C:\\privado\\dos.wiki", content: "clave", dirty: false, format: "wikitext" },
    ],
  });
  const json = JSON.stringify(report);
  assert.equal(report.documents.open, 2);
  assert.equal(report.documents.dirty, 1);
  assert.doesNotMatch(json, /privado|secreto|clave|api\.php/i);
});
