export function matchingCommands(commands, query) {
  const terms = query.toLocaleLowerCase("es").trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return commands;
  return commands.filter((command) => {
    const haystack = `${command.label} ${command.shortcut || ""}`.toLocaleLowerCase("es");
    return terms.every((term) => haystack.includes(term));
  });
}
