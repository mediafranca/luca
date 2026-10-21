export function documentHeadings(text, format) {
  const headings = [];
  let offset = 0;
  for (const line of text.split(/\n/)) {
    const match = format === "wikitext"
      ? line.match(/^(={1,6})\s*(.*?)\s*\1\s*$/)
      : line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match && match[2]) headings.push({ level: match[1].length, label: match[2], offset });
    offset += line.length + 1;
  }
  return headings;
}

export function detectedLineEnding(text) {
  return text.includes("\r\n") ? "CRLF" : text.includes("\r") ? "CR" : "LF";
}
