// Barra de herramientas para el editor de código CodeMirror 6, adaptada de Vera.
// Proporciona formato tipográfico, encabezados, bloques de código, listas, enlaces y editor de tablas.

import { icon } from "./icons.js";
import { readMarkdownTable, newMarkdownTable } from "./markdown-table.js";
import { openTableEditorModal } from "./table-editor.js";
import {
  codeBlock,
  formatLabel,
  headingLine,
  headingMarker,
  inlineMarkers,
  linkSnippet,
  normalizeFormat,
  supportsLineAction,
  toggleInline,
  toggledLine,
} from "./format-syntax.js";
import { isWikitextTableClose, isWikitextTableOpen, readWikitextTable } from "./wikitext-table.js";

/**
 * Crea y conecta la barra de herramientas para un documento activo. `doc.ed`
 * y `doc.format` se leen en cada clic, así la barra emite Markdown o Wikitext
 * según el documento activo; `bar.refresh(format)` actualiza ayudas y botones
 * sin equivalente en el formato.
 */
export function createEditorToolbar(doc, onTableEdit) {
  const format = () => normalizeFormat(doc.format);
  const bar = document.createElement("div");
  bar.className = "editor-toolbar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Herramientas de edición de código");

  const actionButton = (iconName, label, onClick, extraClass = "") => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `toolbar-action ${extraClass}`.trim();
    btn.innerHTML = typeof iconName === "string" && iconName.startsWith("<") ? iconName : icon(iconName);
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  };

  const textButton = (label, title, onClick, extraClass = "") => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `toolbar-action toolbar-text-action ${extraClass}`.trim();
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  };

  // 1. Grupo de encabezados: H1 + menú de niveles
  const headingGroup = document.createElement("div");
  headingGroup.className = "toolbar-group toolbar-headings";

  const applyHeading = (level) => {
    const ed = doc.ed;
    const cursor = ed.getCursor();
    const line = ed.getLineAt(cursor);
    const newText = headingLine(format(), level, line.text);
    ed.replaceRange(newText, line.from, line.to);
    ed.setSelection(line.from + newText.length);
    ed.focus();
  };

  const h1Btn = textButton("H₁", "Encabezado nivel 1 (#)", () => applyHeading(1), "toolbar-h-main");
  h1Btn.dataset.heading = "1";
  const headingToggle = document.createElement("button");
  headingToggle.type = "button";
  headingToggle.className = "toolbar-action toolbar-heading-toggle";
  headingToggle.innerHTML = icon("chevron-down");
  headingToggle.title = "Más niveles de encabezado";
  headingToggle.setAttribute("aria-label", "Más niveles de encabezado");

  let activeHeadingMenu = null;
  const closeHeadingMenu = () => {
    if (activeHeadingMenu) {
      activeHeadingMenu.remove();
      activeHeadingMenu = null;
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onDocKeyDown, true);
    }
  };

  const onDocPointerDown = (e) => {
    if (activeHeadingMenu && !activeHeadingMenu.contains(e.target) && !headingToggle.contains(e.target)) {
      closeHeadingMenu();
    }
  };

  const onDocKeyDown = (e) => {
    if (e.key === "Escape") {
      closeHeadingMenu();
    }
  };

  headingToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (activeHeadingMenu) {
      closeHeadingMenu();
      return;
    }

    const rect = headingToggle.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "toolbar-heading-menu floating-menu";
    menu.style.position = "fixed";
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = "1000";

    const mark = (level) => headingMarker(format(), level);
    const levels = [
      { label: "H₁", level: 1, title: `Título principal (${mark(1)})` },
      { label: "H₂", level: 2, title: `Sección (${mark(2)})` },
      { label: "H₃", level: 3, title: `Subsección (${mark(3)})` },
      { label: "H₄", level: 4, title: `Nivel 4 (${mark(4)})` },
      { label: "H₅", level: 5, title: `Nivel 5 (${mark(5)})` },
      { label: "H₆", level: 6, title: `Nivel 6 (${mark(6)})` },
      { label: "P", level: 0, title: "Párrafo normal (sin encabezado)" },
    ];

    for (const item of levels) {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "toolbar-heading-option";
      opt.textContent = `${item.label} · ${item.title}`;
      opt.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeHeadingMenu();
        applyHeading(item.level);
      });
      menu.append(opt);
    }

    document.body.append(menu);
    activeHeadingMenu = menu;
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onDocKeyDown, true);
  });

  headingGroup.append(h1Btn, headingToggle);

  // 2. Grupo de formato en línea (Bold, Italic, Strikethrough, Underline, Superscript, Subscript, Code)
  const formatGroup = document.createElement("div");
  formatGroup.className = "toolbar-group toolbar-inline-format";

  const applyInline = (kind) => {
    const ed = doc.ed;
    const [open, close] = inlineMarkers(format(), kind);
    const sel = ed.getSelection();
    if (sel.empty) {
      ed.replaceSelection(`${open}${close}`);
      ed.setSelection(sel.from + open.length);
      return;
    }
    const result = toggleInline(ed.getDoc(), sel.from, sel.to, open, close);
    ed.replaceRange(result.insert, result.from, result.to);
    ed.setSelection(result.selectionStart, result.selectionEnd);
  };

  const inlineButton = (kind, iconName, label, extraClass = "") => {
    const btn = actionButton(iconName, label, () => applyInline(kind), extraClass);
    btn.dataset.inline = kind;
    btn.dataset.label = label;
    return btn;
  };

  formatGroup.append(
    inlineButton("bold", "bold", "Negrita"),
    inlineButton("italic", "italic", "Cursiva", "format-italic"),
    inlineButton("strikethrough", "strikethrough", "Tachado", "format-strike"),
    inlineButton("underline", "underline", "Subrayado", "format-underline"),
    inlineButton("superscript", "superscript", "Superíndice"),
    inlineButton("subscript", "subscript", "Subíndice"),
    inlineButton("code", "code", "Código en línea")
  );

  // 3. Grupo de bloques y listas
  const blockGroup = document.createElement("div");
  blockGroup.className = "toolbar-group toolbar-blocks";

  const toggleLinePrefix = (kind) => {
    const ed = doc.ed;
    const cursor = ed.getCursor();
    const line = ed.getLineAt(cursor);
    const newText = toggledLine(format(), kind, line.text);
    ed.replaceRange(newText, line.from, line.to);
    ed.setSelection(line.from + newText.length);
  };

  const insertCodeBlock = () => {
    const ed = doc.ed;
    const sel = ed.getSelection();
    const block = codeBlock(format(), sel.empty ? "" : sel.text);
    ed.replaceSelection(block.insert);
    ed.setSelection(sel.from + block.selectionStart, sel.from + block.selectionEnd);
  };

  const lineButton = (kind, iconName, label) => {
    const btn = actionButton(iconName, label, () => toggleLinePrefix(kind));
    btn.dataset.line = kind;
    btn.dataset.label = label;
    return btn;
  };

  const codeBlockBtn = actionButton("code-block", "Bloque de código", insertCodeBlock);
  codeBlockBtn.dataset.block = "code";
  blockGroup.append(
    lineButton("quote", "quote", "Cita"),
    lineButton("bullet", "list", "Lista con viñetas"),
    lineButton("numbered", "list-numbers", "Lista numerada"),
    lineButton("task", "list-check", "Lista de tareas"),
    codeBlockBtn
  );

  // 4. Grupo de enlaces y tablas
  const linksGroup = document.createElement("div");
  linksGroup.className = "toolbar-group toolbar-links";

  const insertLink = (isInternal) => {
    const ed = doc.ed;
    const sel = ed.getSelection();
    const link = linkSnippet(format(), isInternal ? "internal" : "external", sel.empty ? "" : sel.text);
    ed.replaceSelection(link.insert);
    ed.setSelection(sel.from + link.selectionStart, sel.from + link.selectionEnd);
  };

  // Bloque `{| … |}` que contiene la línea del cursor, o null.
  const wikitextTableAround = (ed, curLine) => {
    const fullText = ed.getDoc();
    let startLine = curLine;
    while (!isWikitextTableOpen(startLine.text)) {
      if (isWikitextTableClose(startLine.text) && startLine !== curLine) return null;
      if (startLine.number <= 1) return null;
      startLine = ed.getLineAt(startLine.from - 1);
    }
    let endLine = curLine;
    while (!isWikitextTableClose(endLine.text)) {
      if (endLine.to >= fullText.length) return null;
      endLine = ed.getLineAt(endLine.to + 1);
      if (isWikitextTableOpen(endLine.text)) return null;
    }
    return { from: startLine.from, to: endLine.to, text: fullText.slice(startLine.from, endLine.to) };
  };

  const handleTableButton = () => {
    const ed = doc.ed;
    const cursor = ed.getCursor();
    const curLine = ed.getLineAt(cursor);
    const currentFormat = format();

    if (currentFormat === "wikitext") {
      const block = wikitextTableAround(ed, curLine);
      const parsed = block ? readWikitextTable(block.text) : null;
      if (block && parsed) {
        openTableEditorModal({
          table: parsed,
          format: currentFormat,
          onSave: (updated, serialized) => {
            ed.replaceRange(serialized, block.from, block.to);
            ed.setSelection(block.from + serialized.length);
          },
        });
        return;
      }
    }

    // ¿El cursor está dentro de una tabla Markdown existente?
    if (currentFormat === "markdown" && curLine.text.trim().startsWith("|") && curLine.text.trim().endsWith("|")) {
      const fullText = ed.getDoc();
      let startLine = curLine;
      let endLine = curLine;

      // Buscar inicio de la tabla hacia arriba
      while (startLine.number > 1) {
        const prev = ed.getLineAt(startLine.from - 1);
        if (prev.text.trim().startsWith("|") && prev.text.trim().endsWith("|")) {
          startLine = prev;
        } else {
          break;
        }
      }

      // Buscar fin de la tabla hacia abajo
      const totalLen = fullText.length;
      while (endLine.to < totalLen) {
        const next = ed.getLineAt(endLine.to + 1);
        if (next.text.trim().startsWith("|") && next.text.trim().endsWith("|")) {
          endLine = next;
        } else {
          break;
        }
      }

      const tableBlockText = fullText.slice(startLine.from, endLine.to);
      const parsed = readMarkdownTable(tableBlockText);
      if (parsed) {
        openTableEditorModal({
          table: parsed,
          onSave: (updated, serialized) => {
            ed.replaceRange(serialized, startLine.from, endLine.to);
            ed.setSelection(startLine.from + serialized.length);
          },
        });
        return;
      }
    }

    // No está en tabla: crear tabla nueva
    openTableEditorModal({
      table: newMarkdownTable(3, 3, "row"),
      format: currentFormat,
      onSave: (updated, serialized) => {
        const prefix = curLine.text.trim() === "" ? "" : "\n\n";
        const suffix = "\n";
        ed.replaceSelection(`${prefix}${serialized}${suffix}`);
      },
    });
  };

  const linkBtn = actionButton("link", "Enlace externo", () => insertLink(false));
  linkBtn.dataset.link = "external";
  const tableBtn = actionButton("grid", "Editor de tabla", handleTableButton, "toolbar-table-btn");
  linksGroup.append(
    linkBtn,
    actionButton("brackets", "Enlace interno ([[página]])", () => insertLink(true)),
    tableBtn
  );

  bar.append(headingGroup, formatGroup, blockGroup, linksGroup);

  // Ayudas y disponibilidad de cada botón según el formato del documento activo.
  const setTitle = (btn, title) => { btn.title = title; btn.setAttribute("aria-label", title); };
  bar.refresh = (nextFormat) => {
    const f = normalizeFormat(nextFormat);
    bar.dataset.format = f;
    setTitle(h1Btn, `Encabezado nivel 1 (${headingMarker(f, 1)})`);
    for (const btn of bar.querySelectorAll("[data-inline]")) {
      const [open, close] = inlineMarkers(f, btn.dataset.inline);
      setTitle(btn, `${btn.dataset.label} (${open}texto${close})`);
    }
    for (const btn of bar.querySelectorAll("[data-line]")) {
      const kind = btn.dataset.line;
      btn.hidden = !supportsLineAction(f, kind);
      const sample = toggledLine(f, kind, kind === "quote" ? "bloque" : kind === "task" ? "tarea" : "elemento");
      setTitle(btn, `${btn.dataset.label} (${sample})`);
    }
    setTitle(codeBlockBtn, f === "wikitext" ? "Bloque de código (<pre>)" : "Bloque de código (```)");
    setTitle(linkBtn, f === "wikitext" ? "Enlace externo ([url texto])" : "Enlace Markdown ([texto](url))");
    setTitle(tableBtn, `Editor de tabla ${formatLabel(f)} (▦)`);
  };
  bar.refresh(format());
  return bar;
}

/**
 * Abre el editor de tablas para una tabla específica del documento.
 */
export function editDocumentTableAtIndex(doc, tableIndex) {
  const ed = doc.ed;
  const fullText = ed.getDoc();
  const lines = fullText.split(/\r?\n/);
  let currentIndex = 0;
  let inTable = false;
  let startLineNum = -1;
  let tableLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = line.trim().startsWith("|") && line.trim().endsWith("|");

    if (isTableRow) {
      if (!inTable) {
        inTable = true;
        startLineNum = i;
        tableLines = [line];
      } else {
        tableLines.push(line);
      }
    } else {
      if (inTable) {
        inTable = false;
        const block = tableLines.join("\n");
        const parsed = readMarkdownTable(block);
        if (parsed) {
          if (currentIndex === tableIndex) {
            const startPos = lines.slice(0, startLineNum).join("\n").length + (startLineNum > 0 ? 1 : 0);
            const endPos = startPos + block.length;
            openTableEditorModal({
              table: parsed,
              onSave: (updated, serialized) => {
                ed.replaceRange(serialized, startPos, endPos);
                ed.setSelection(startPos + serialized.length);
              },
            });
            return;
          }
          currentIndex++;
        }
        tableLines = [];
      }
    }
  }

  // Si la tabla terminaba al final del documento
  if (inTable && tableLines.length > 0) {
    const block = tableLines.join("\n");
    const parsed = readMarkdownTable(block);
    if (parsed && currentIndex === tableIndex) {
      const startPos = lines.slice(0, startLineNum).join("\n").length + (startLineNum > 0 ? 1 : 0);
      const endPos = startPos + block.length;
      openTableEditorModal({
        table: parsed,
        onSave: (updated, serialized) => {
          ed.replaceRange(serialized, startPos, endPos);
          ed.setSelection(startPos + serialized.length);
        },
      });
    }
  }
}
