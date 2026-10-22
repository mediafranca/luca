import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CATALOGS, LANGUAGES, MENU_KEYS, detectLanguage, menuLabels, setLanguage, t } from "../ui/i18n.js";

const read = (name) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const placeholders = (text) =>
  [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("todos los idiomas cubren las mismas claves", () => {
  const base = Object.keys(CATALOGS.es);
  assert.ok(base.length > 200, "el catálogo español es la fuente y no puede estar casi vacío");
  for (const lang of LANGUAGES) {
    const faltan = base.filter((key) => CATALOGS[lang][key] === undefined);
    const sobran = Object.keys(CATALOGS[lang]).filter((key) => CATALOGS.es[key] === undefined);
    assert.deepEqual(faltan, [], `${lang}: claves sin traducir`);
    assert.deepEqual(sobran, [], `${lang}: claves que no existen en español`);
  }
});

test("una traducción no pierde ni inventa parámetros", () => {
  // Si el español dice {name} y el inglés no, el nombre desaparece de la frase.
  for (const lang of LANGUAGES) {
    const descuadradas = Object.keys(CATALOGS.es).filter(
      (key) => placeholders(CATALOGS.es[key]) !== placeholders(CATALOGS[lang][key]),
    );
    assert.deepEqual(descuadradas, [], `${lang}: parámetros distintos a los del español`);
  }
});

test("t() resuelve claves, argumentos de Rust y deja pasar lo desconocido", () => {
  setLanguage("es");
  assert.equal(t("prefs.title"), "Preferencias");
  assert.equal(t("dialog.unsaved", { name: "nota.md" }), '"nota.md" tiene cambios sin guardar. ¿Cerrar igual?');
  // Rust devuelve clave|argumento; el argumento entra como {0}.
  assert.equal(t("err.wiki.http|503"), "La wiki respondió HTTP 503");
  // Lo que no es una clave se muestra tal cual: un error del sistema sigue legible.
  assert.equal(t("Permission denied"), "Permission denied");
  assert.equal(t(), "");
  setLanguage("en");
  assert.equal(t("prefs.title"), "Settings");
  setLanguage("zz");
  assert.equal(t("prefs.title"), "Preferencias", "un idioma desconocido cae en la fuente");
  setLanguage("es");
});

test("el idioma se deduce del sistema y cae en inglés si no lo tenemos", () => {
  assert.equal(detectLanguage(["es-CL", "en-US"]), "es");
  assert.equal(detectLanguage(["en-GB"]), "en");
  assert.equal(detectLanguage(["fr-FR", "es-ES"]), "es", "se recorre la lista, no sólo el primero");
  assert.equal(detectLanguage(["fr-FR"]), "en");
  assert.equal(detectLanguage([]), "en");
  assert.equal(detectLanguage([null, undefined]), "en");
});

// ---- Las dos fronteras: el HTML y Rust usan claves de este catálogo --------

test("cada clave marcada en el HTML existe en el catálogo", () => {
  const html = read("ui/index.html");
  const usadas = [...html.matchAll(/data-i18n(?:-html|-title|-aria-label|-placeholder|-alt)?="([^"]+)"/g)]
    .map((m) => m[1]);
  assert.ok(usadas.length > 80, "el HTML debería estar marcado para traducción");
  const huerfanas = [...new Set(usadas)].filter((key) => CATALOGS.es[key] === undefined);
  assert.deepEqual(huerfanas, [], "claves marcadas en el HTML que nadie traduce");
});

test("cada error que devuelve Rust es una clave del catálogo", () => {
  const rust = read("src-tauri/src/main.rs");
  // Rust no redacta mensajes: emite claves err.*, con argumento opcional.
  const claves = [...rust.matchAll(/"(err\.[a-z_.]+)(?:\|[^"]*)?"/g)].map((m) => m[1]);
  assert.ok(claves.length >= 12, "Rust debería emitir claves, no prosa");
  const huerfanas = [...new Set(claves)].filter((key) => CATALOGS.es[key] === undefined);
  assert.deepEqual(huerfanas, [], "claves de error que Rust emite y el catálogo no tiene");
});

test("Rust consume exactamente las etiquetas de menú que el frontend envía", () => {
  const rust = read("src-tauri/src/main.rs");
  const consumidas = [...rust.matchAll(/lbl\("([a-z_.]+)",/g)].map((m) => m[1]);
  const enviadas = Object.keys(menuLabels());
  assert.deepEqual(
    [...new Set(consumidas)].filter((key) => !enviadas.includes(key)),
    [],
    "Rust pide etiquetas que el frontend no envía",
  );
  assert.deepEqual(
    enviadas.filter((key) => !consumidas.includes(key)),
    [],
    "el frontend envía etiquetas que Rust no usa",
  );
  assert.equal(enviadas.length, MENU_KEYS.length);
});

test("el respaldo español de Rust coincide con el catálogo", () => {
  // Los literales que quedan en Rust son sólo el arranque, antes de que la
  // ventana cargue: si se desvían del catálogo, el menú cambia de texto solo.
  const rust = read("src-tauri/src/main.rs");
  setLanguage("es");
  const desviados = [...rust.matchAll(/lbl\("([a-z_.]+)",\s*"([^"]*)"\)/g)]
    .map(([, key, fallback]) => ({ key, fallback, esperado: t(`menu.${key}`) }))
    .filter(({ fallback, esperado }) => fallback !== esperado);
  assert.deepEqual(desviados, []);
});
