import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DESIGN_NAME, DESIGNS_KEY, diagnosticReport, migrateSettings,
  SETTINGS_SCHEMA_VERSION, uniqueDesignName,
} from "../ui/settings-state.js";

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

test("el juego único de tokens se convierte en el primer diseño", () => {
  const storage = memoryStorage({
    "luca.tokens": JSON.stringify({ general: { "--text-size": "18px" }, light: { "--bg": "#fff" } }),
  });
  migrateSettings(storage);
  const designs = JSON.parse(storage.getItem(DESIGNS_KEY));
  assert.equal(designs.active, DEFAULT_DESIGN_NAME);
  assert.equal(designs.list.length, 1);
  assert.equal(designs.list[0].name, DEFAULT_DESIGN_NAME);
  assert.equal(designs.list[0].general["--text-size"], "18px");
  assert.equal(designs.list[0].light["--bg"], "#fff");
  // El respaldo plano se conserva: la lista puede corromperse.
  assert.ok(storage.getItem("luca.tokens"));
});

test("el formato plano antiguo no se pierde al crear el primer diseño", () => {
  const storage = memoryStorage({ "luca.tokens": JSON.stringify({ "--bg": "#111", "--text-size": "20px" }) });
  migrateSettings(storage);
  const design = JSON.parse(storage.getItem(DESIGNS_KEY)).list[0];
  // Sin general/light/dark se reparte en los tres; quien filtra por nombre de
  // token conocido es normalizeTokens al leerlo.
  for (const grupo of ["general", "light", "dark"]) {
    assert.equal(design[grupo]["--bg"], "#111");
  }
});

test("una lista de diseños ya existente no se sobreescribe", () => {
  const mio = JSON.stringify({ active: "Mío", list: [{ name: "Mío", general: {}, light: {}, dark: {} }] });
  const storage = memoryStorage({ [DESIGNS_KEY]: mio, "luca.tokens": '{"general":{"--bg":"#000"}}' });
  migrateSettings(storage);
  assert.equal(storage.getItem(DESIGNS_KEY), mio);
});

test("los nombres de diseño repetidos se numeran y renombrar no choca consigo mismo", () => {
  assert.equal(uniqueDesignName([], "Noche"), "Noche");
  assert.equal(uniqueDesignName(["Noche"], "Noche"), "Noche 2");
  assert.equal(uniqueDesignName(["Noche", "Noche 2"], "Noche"), "Noche 3");
  assert.equal(uniqueDesignName(["Noche"], "   "), DEFAULT_DESIGN_NAME);
  // Renombrar «Noche» a «Noche» debe quedarse en «Noche», no saltar a «Noche 2».
  assert.equal(uniqueDesignName(["Noche", "Día"], "Noche", { exclude: "Noche" }), "Noche");
  assert.equal(uniqueDesignName(["Noche", "Día"], "Día", { exclude: "Noche" }), "Día 2");
});
