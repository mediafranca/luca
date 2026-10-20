// Barra de herramientas para el editor de código CodeMirror 6, adaptada de Vera.
// Proporciona formato tipográfico, encabezados, bloques de código, listas, enlaces y editor de tablas.

import { icon } from "./icons.js";
import { readMarkdownTable, newMarkdownTable } from "./markdown-table.js";
import { openTableEditorModal } from "./table-editor.js";

/**
 * Crea y conecta la barra de herramientas para un documento activo.
 */
export function createEditorToolbar(doc, onTableEdit) {
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
    const stripped = line.text.replace(/^#{1,6}\s+/, "");
    const newText = level > 0 ? `${"#".repeat(level)} ${stripped}` : stripped;
    ed.replaceRange(newText, line.from, line.to);
    ed.setSelection(line.from + newText.length);
    ed.focus();
  };

  const h1Btn = textButton("H₁", "Encabezado nivel 1 (#)", () => applyHeading(1), "toolbar-h-main");
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

    const levels = [
      { label: "H₁", level: 1, title: "Título principal (#)" },
      { label: "H₂", level: 2, title: "Sección (##)" },
      { label: "H₃", level: 3, title: "Subsección (###)" },
      { label: "H₄", level: 4, title: "Nivel 4 (####)" },
      { label: "H₅", level: 5, title: "Nivel 5 (#####)" },
      { label: "H₆", level: 6, title: "Nivel 6 (######)" },
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

  const applyInline = (marker) => {
    const ed = doc.ed;
    const sel = ed.getSelection();
    const w = marker.length;
    if (sel.empty) {
      ed.replaceSelection(`${marker}${marker}`);
      ed.setSelection(sel.from + w);
      return;
    }
    if (sel.text.startsWith(marker) && sel.text.endsWith(marker) && sel.text.length >= w * 2) {
      const inner = sel.text.slice(w, -w);
      ed.replaceSelection(inner);
      ed.setSelection(sel.from, sel.from + inner.length);
      return;
    }
    const fullDoc = ed.getDoc();
    if (
      sel.from >= w &&
      fullDoc.slice(sel.from - w, sel.from) === marker &&
      fullDoc.slice(sel.to, sel.to + w) === marker
    ) {
      ed.replaceRange(sel.text, sel.from - w, sel.to + w);
      ed.setSelection(sel.from - w, sel.from - w + sel.text.length);
      return;
    }
    ed.replaceSelection(`${marker}${sel.text}${marker}`);
    ed.setSelection(sel.from + w, sel.to + w);
  };

  formatGroup.append(
    actionButton("bold", "Negrita (**texto**)", () => applyInline("**")),
    actionButton("italic", "Cursiva (*texto*)", () => applyInline("*"), "format-italic"),
    actionButton("strikethrough", "Tachado (~~texto~~)", () => applyInline("~~"), "format-strike"),
    actionButton("underline", "Subrayado (++texto++)", () => applyInline("++"), "format-underline"),
    actionButton("superscript", "Superíndice (^texto^)", () => applyInline("^")),
    actionButton("subscript", "Subíndice (~texto~)", () => applyInline("~")),
    actionButton("code", "Código en línea (`código`)", () => applyInline("`"))
  );

  // 3. Grupo de bloques y listas
  const blockGroup = document.createElement("div");
  blockGroup.className = "toolbar-group toolbar-blocks";

  const toggleLinePrefix = (prefix) => {
    const ed = doc.ed;
    const cursor = ed.getCursor();
    const line = ed.getLineAt(cursor);
    let newText;
    if (line.text.startsWith(prefix)) {
      newText = line.text.slice(prefix.length);
    } else {
      // Reemplaza otros prefijos de lista si existen
      const clean = line.text.replace(/^(\s*[-*+]\s*|\s*\d+\.\s*|\s*>\s*|\s*-\s*\[[ xX]\]\s*)/, "");
      newText = `${prefix}${clean}`;
    }
    ed.replaceRange(newText, line.from, line.to);
    ed.setSelection(line.from + newText.length);
  };

  const insertCodeBlock = () => {
    const ed = doc.ed;
    const sel = ed.getSelection();
    if (sel.empty) {
      ed.replaceSelection("```\n\n```\n");
      ed.setSelection(sel.from + 4);
    } else {
      ed.replaceSelection(`\`\`\`\n${sel.text}\n\`\`\`\n`);
      ed.setSelection(sel.from + 4, sel.from + 4 + sel.text.length);
    }
  };

  blockGroup.append(
    actionButton("quote", "Cita (> bloque)", () => toggleLinePrefix("> ")),
    actionButton("list", "Lista con viñetas (- elemento)", () => toggleLinePrefix("- ")),
    actionButton("list-numbers", "Lista numerada (1. elemento)", () => toggleLinePrefix("1. ")),
    actionButton("list-check", "Lista de tareas (- [ ] tarea)", () => toggleLinePrefix("- [ ] ")),
    actionButton("code-block", "Bloque de código (```)", insertCodeBlock)
  );

  // 4. Grupo de enlaces y tablas
  const linksGroup = document.createElement("div");
  linksGroup.className = "toolbar-group toolbar-links";

  const insertLink = (isInternal) => {
    const ed = doc.ed;
    const sel = ed.getSelection();
    if (isInternal) {
      if (sel.empty) {
        ed.replaceSelection("[[]]");
        ed.setSelection(sel.from + 2);
      } else {
        ed.replaceSelection(`[[${sel.text}]]`);
        ed.setSelection(sel.from + 2, sel.from + 2 + sel.text.length);
      }
    } else {
      if (sel.empty) {
        ed.replaceSelection("[texto](https://)");
        ed.setSelection(sel.from + 1, sel.from + 6);
      } else {
        ed.replaceSelection(`[${sel.text}](https://)`);
        ed.setSelection(sel.from + sel.text.length + 3, sel.from + sel.text.length + 11);
      }
    }
  };

  const handleTableButton = () => {
    const ed = doc.ed;
    const cursor = ed.getCursor();
    const curLine = ed.getLineAt(cursor);

    // ¿El cursor está dentro de una tabla Markdown existente?
    if (curLine.text.trim().startsWith("|") && curLine.text.trim().endsWith("|")) {
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
      onSave: (updated, serialized) => {
        const prefix = curLine.text.trim() === "" ? "" : "\n\n";
        const suffix = "\n";
        ed.replaceSelection(`${prefix}${serialized}${suffix}`);
      },
    });
  };

  linksGroup.append(
    actionButton("link", "Enlace Markdown ([texto](url))", () => insertLink(false)),
    actionButton("brackets", "Enlace interno ([[página]])", () => insertLink(true)),
    actionButton("grid", "Editor de tabla Markdown (▦)", handleTableButton, "toolbar-table-btn")
  );

  bar.append(headingGroup, formatGroup, blockGroup, linksGroup);
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
