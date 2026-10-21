#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const artifactSuffixes = [".appimage", ".deb", ".dmg", ".exe", ".msi", ".rpm", ".sig", ".tar.gz"];

function artifactFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (
        relative(root, path).split(/[\\/]/).includes("bundle") &&
        artifactSuffixes.some((suffix) => entry.name.toLowerCase().endsWith(suffix))
      ) files.push(path);
    }
  };
  visit(root);
  return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

export function buildArtifactManifest(root) {
  return artifactFiles(root).map((path) => {
    const bytes = readFileSync(path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    return `${sha256}  ${statSync(path).size}  ${relative(root, path).replaceAll("\\", "/")}`;
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || "src-tauri/target");
  const output = resolve(process.argv[3] || `checksums-${process.platform}-${process.arch}.txt`);
  const lines = buildArtifactManifest(root);
  if (!lines.length) throw new Error(`No se encontraron instaladores en ${root}`);
  writeFileSync(output, `${lines.join("\n")}\n`);
  console.log(`artefactos: ${lines.length} tamaños y SHA-256 escritos en ${basename(output)}`);
}
