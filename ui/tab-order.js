// Operaciones puras sobre el orden de las pestañas. No recrean documentos:
// quien llama reemplaza únicamente el orden del arreglo que ya contiene los
// editores, historiales y estados de desplazamiento vivos.
export function reorderById(items, movedId, targetId, placement = "before") {
  if (movedId === targetId) return [...items];
  const from = items.findIndex((item) => item.id === movedId);
  const target = items.findIndex((item) => item.id === targetId);
  if (from < 0 || target < 0) return [...items];

  const next = [...items];
  const [moved] = next.splice(from, 1);
  let insertAt = next.findIndex((item) => item.id === targetId);
  if (placement === "after") insertAt += 1;
  next.splice(insertAt, 0, moved);
  return next;
}

export function moveByOffset(items, movedId, offset) {
  const from = items.findIndex((item) => item.id === movedId);
  if (from < 0 || !offset) return [...items];
  const to = Math.max(0, Math.min(items.length - 1, from + offset));
  if (to === from) return [...items];

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
