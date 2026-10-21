import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildArtifactManifest } from "../scripts/artifact-manifest.mjs";

test("publica tamaño y SHA-256 sólo para instaladores, en orden estable", () => {
  const root = mkdtempSync(join(tmpdir(), "luca-artifacts-"));
  try {
    mkdirSync(join(root, "bundle"));
    mkdirSync(join(root, "bundle", "nsis"));
    writeFileSync(join(root, "bundle", "Luca_0.6.0_amd64.deb"), "luca");
    writeFileSync(join(root, "bundle", "nsis", "Luca_0.6.0_x64-setup.exe"), "setup");
    writeFileSync(join(root, "test-helper.exe"), "ignorar");
    writeFileSync(join(root, "intermedio.o"), "ignorar");

    assert.deepEqual(buildArtifactManifest(root), [
      "d70f47790f689414789eeff231703429c7f88a10210775906460edbf38589d90  4  bundle/Luca_0.6.0_amd64.deb",
      "8fb6d5f37e8055ce720bd0b1d56587f88c0071f285966ba17e72b2b12672aa73  5  bundle/nsis/Luca_0.6.0_x64-setup.exe",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
