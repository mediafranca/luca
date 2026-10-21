#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriRoot = join(root, "src-tauri");
const config = JSON.parse(readFileSync(join(tauriRoot, "tauri.conf.json"), "utf8"));
const bundle = config.bundle;

assert.equal(bundle.category, "Productivity");
assert.match(bundle.shortDescription, /Markdown/i);
assert.match(bundle.longDescription, /MediaFranca/);
assert.equal(bundle.fileAssociations[0].mimeType, "text/markdown");

const expectedIcons = {
  "icons/32x32.png": [32, 32],
  "icons/128x128.png": [128, 128],
  "icons/128x128@2x.png": [256, 256],
  "icons/icon.png": [512, 512],
};

for (const [relativePath, [width, height]] of Object.entries(expectedIcons)) {
  assert.ok(bundle.icon.includes(relativePath), "falta " + relativePath + " en bundle.icon");
  const path = join(tauriRoot, relativePath);
  assert.ok(existsSync(path), "no existe " + relativePath);
  const png = readFileSync(path);
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), width);
  assert.equal(png.readUInt32BE(20), height);
}

for (const relativePath of ["icons/icon.icns", "icons/icon.ico"]) {
  assert.ok(bundle.icon.includes(relativePath), "falta " + relativePath + " en bundle.icon");
  assert.ok(existsSync(join(tauriRoot, relativePath)), "no existe " + relativePath);
}

const desktopPath = join(tauriRoot, bundle.linux.deb.desktopTemplate);
const desktop = readFileSync(desktopPath, "utf8");
for (const contract of [
  "Categories={{categories}}",
  "Exec={{exec}} %F",
  "StartupWMClass=luca",
  "Icon={{icon}}",
  "MimeType=text/markdown;",
]) {
  assert.ok(desktop.includes(contract), "el lanzador Linux no contiene: " + contract);
}

console.log("packaging: iconos, metadatos y asociación Markdown verificados");
