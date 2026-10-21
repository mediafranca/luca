import test from "node:test";
import assert from "node:assert/strict";

import { moveByOffset, reorderById } from "../ui/tab-order.js";

const docs = () => [{ id: 1 }, { id: 2 }, { id: 3 }];
const ids = (items) => items.map((item) => item.id);

test("reordena una pestaña antes o después de otra sin recrear documentos", () => {
  const original = docs();
  const before = reorderById(original, 3, 1, "before");
  const after = reorderById(original, 1, 3, "after");

  assert.deepEqual(ids(before), [3, 1, 2]);
  assert.deepEqual(ids(after), [2, 3, 1]);
  assert.equal(before[0], original[2]);
  assert.equal(after[2], original[0]);
  assert.deepEqual(ids(original), [1, 2, 3]);
});

test("mueve una pestaña con teclado sin salir de los extremos", () => {
  assert.deepEqual(ids(moveByOffset(docs(), 2, -1)), [2, 1, 3]);
  assert.deepEqual(ids(moveByOffset(docs(), 2, 1)), [1, 3, 2]);
  assert.deepEqual(ids(moveByOffset(docs(), 1, -1)), [1, 2, 3]);
  assert.deepEqual(ids(moveByOffset(docs(), 3, 1)), [1, 2, 3]);
});
