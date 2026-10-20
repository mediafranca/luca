#!/usr/bin/env node
// Copia el subconjunto runtime de mermaid@12 + add-ons + marked a ui/vendor/.
// Sigue el grafo de imports relativos (.mjs) desde cada entry y copia su cierre
// transitivo — nada de .map ni .d.ts. Idempotente: salta si ya existe (--force).
import { readFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "ui", "vendor");
const force = process.argv.includes("--force");

if (existsSync(out) && !force) {
  console.log("vendor: ui/vendor ya existe (usa --force para rehacer)");
  process.exit(0);
}
rmSync(out, { recursive: true, force: true });

// entry → carpeta destino bajo ui/vendor/
const nm = join(root, "node_modules");
const packages = [
  [join(nm, "marked/lib/marked.esm.js"), "marked"],
  [join(nm, "mermaid/dist/mermaid.esm.min.mjs"), "mermaid"],
  [join(nm, "@mermaid-js/layout-elk/dist/mermaid-layout-elk.esm.min.mjs"), "layout-elk"],
  [join(nm, "@mermaid-js/mermaid-zenuml/dist/mermaid-zenuml.esm.min.mjs"), "zenuml"],
  [join(nm, "@mermaid-js/layout-tidy-tree/dist/mermaid-layout-tidy-tree.esm.min.mjs"), "tidy-tree"],
];

// Captura imports/exports/dynamic-import a archivos relativos .mjs/.js
const relImport = /["'](\.\.?\/[^"']+?\.m?js)["']/g;

let count = 0;
for (const [entry, name] of packages) {
  const base = dirname(entry);           // raíz del paquete para rutas relativas
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) continue; // cadena que parece import pero no se envió
    const code = readFileSync(file, "utf8");
    // destino preserva la ruta relativa al entry base
    const dst = join(out, name, relative(base, file));
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(file, dst);
    count++;
    for (const m of code.matchAll(relImport)) {
      queue.push(resolve(dirname(file), m[1]));
    }
  }
  console.log(`vendor: ${name} (${seen.size} archivos)`);
}
console.log(`vendor: ${count} archivos copiados en ui/vendor/`);

// CodeMirror 6 usa imports "bare", así que se empaqueta con esbuild en vez de
// copiarse. Un único editor.js ESM, sin dependencias externas.
const esbuild = await import("esbuild");
await esbuild.build({
  entryPoints: [join(root, "ui", "editor.src.js")],
  outfile: join(out, "codemirror", "editor.js"),
  bundle: true,
  format: "esm",
  minify: true,
  logLevel: "warning",
});
console.log("vendor: codemirror (editor.js empaquetado con esbuild)");
