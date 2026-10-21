import test from "node:test";
import assert from "node:assert/strict";
import { matchingCommands } from "../ui/command-search.js";

const commands = [
  { label: "Guardar como", shortcut: "Ctrl+Shift+S" },
  { label: "Vista dividida", shortcut: "Ctrl+2" },
];

test("la paleta busca por nombre y atajo sin distinguir mayúsculas", () => {
  assert.deepEqual(matchingCommands(commands, "GUARDAR shift"), [commands[0]]);
  assert.deepEqual(matchingCommands(commands, "ctrl+2"), [commands[1]]);
});
