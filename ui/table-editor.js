// Editor visual de tablas Markdown, reciclado del sistema de tablas de Vera.
// Proporciona edición bidimensional con formato inline, agregar/eliminar filas y columnas,
// alineación, cabeceras en fila o columna, pegado desde hojas de cálculo y atajos de teclado.

import { icon } from "./icons.js";
import { t } from "./i18n.js";

// El modificador de los atajos de celda, igual que en la paleta.
const CELL_MOD = navigator.platform?.includes("Mac") ? "⌘" : "Ctrl+";
import {
  cloneTable,
  tableHeaderAxis,
  changeTableHeaderAxis,
  tabularClipboard,
  writeMarkdownTable,
} from "./markdown-table.js";
import { writeWikitextTable } from "./wikitext-table.js";
import { formatLabel, inlineMarkers, linkSnippet, normalizeFormat, toggleInline } from "./format-syntax.js";

// El marcado de celda (negrita, cursiva, código, enlace) sigue al formato del
// documento: Markdown o Wikitext.
function resolveCellFormat(format, kind, text, start, end) {
  const [open, close] = inlineMarkers(format, kind);
  return toggleInline(text, start, end, open, close);
}

function resolveCellLink(format, text, start, end) {
  const link = linkSnippet(format, "external", text.slice(start, end));
  return {
    buffer: text.slice(0, start) + link.insert + text.slice(end),
    selectionStart: start + link.selectionStart,
    selectionEnd: start + link.selectionEnd,
  };
}

function fitCellHeight(input) {
  input.style.height = "auto";
  input.style.height = `${Math.max(28, input.scrollHeight)}px`;
}

/**
 * Monta el editor visual de tablas dentro del contenedor dado.
 */
export function mountMarkdownTableEditor(host, originalTable, options = {}) {
  let table = cloneTable(originalTable);
  let headerAxis = tableHeaderAxis(table);
  let active = {
    row: Math.max(headerAxis === "column" ? 1 : 0, Math.min(options.initial?.row ?? (headerAxis === "column" ? 1 : 0), table.rows.length)),
    column: Math.max(0, Math.min(options.initial?.column ?? 0, table.header.length - 1)),
  };
  let activeInput = null;
  let dirty = false;
  const format = normalizeFormat(options.format);

  const rowAt = (r) => (r === 0 ? table.header : table.rows[r - 1]);

  const focus = (address, atEnd = false) => {
    const input = host.querySelector(
      `.table-cell-input[data-row="${address.row}"][data-column="${address.column}"]`
    );
    if (!input) return;
    input.focus({ preventScroll: true });
    const caret = atEnd ? input.value.length : 0;
    input.setSelectionRange(caret, caret);
  };

  const updateActive = (input) => {
    activeInput = input;
    active = {
      row: Number(input.dataset.row ?? 0),
      column: Number(input.dataset.column ?? 0),
    };
    const status = host.querySelector(".table-editor-status");
    if (status) {
      status.textContent =
        headerAxis === "row" && active.row === 0
          ? `encabezado · columna ${active.column + 1}`
          : headerAxis === "column" && active.column === 0
          ? `encabezado · fila ${active.row}`
          : `fila ${active.row} · columna ${active.column + 1}`;
    }
    const removeRowBtn = host.querySelector('[data-table-action="remove-row"]');
    if (removeRowBtn) removeRowBtn.disabled = active.row === 0 || table.rows.length === 0;
    const removeColBtn = host.querySelector('[data-table-action="remove-column"]');
    if (removeColBtn) removeColBtn.disabled = table.header.length <= 1;

    for (const btn of host.querySelectorAll("[data-table-align]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.tableAlign === (table.alignments[active.column] ?? "left")));
    }
  };

  const applyOutcome = (outcome) => {
    if (!activeInput) return;
    activeInput.value = outcome.buffer;
    fitCellHeight(activeInput);
    rowAt(active.row)[active.column] = outcome.buffer;
    dirty = true;
    activeInput.setSelectionRange(outcome.selectionStart, outcome.selectionEnd);
    activeInput.focus();
  };

  const button = (iconName, title, action, data = {}) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "table-editor-action";
    btn.innerHTML = icon(iconName);
    btn.title = title;
    btn.setAttribute("aria-label", title);
    if (data.action) btn.dataset.tableAction = data.action;
    if (data.align) btn.dataset.tableAlign = data.align;
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      action();
    });
    return btn;
  };

  const render = (nextFocus) => {
    host.replaceChildren();

    const editor = document.createElement("div");
    editor.className = "table-editor";
    editor.setAttribute("aria-label", "editor visual de tabla Markdown");

    // Barra de herramientas superior
    const tools = document.createElement("div");
    tools.className = "table-editor-tools";
    tools.setAttribute("role", "toolbar");

    // Grupo de formato
    const format = document.createElement("div");
    format.className = "table-editor-tool-group";
    const formatWith = (kind) => {
      if (!activeInput) return;
      applyOutcome(
        resolveCellFormat(format, kind, activeInput.value, activeInput.selectionStart ?? 0, activeInput.selectionEnd ?? activeInput.value.length)
      );
    };
    format.append(
      button("bold", t("table.cell_bold", { key: CELL_MOD }), () => formatWith("bold")),
      button("italic", t("table.cell_italic", { key: CELL_MOD }), () => formatWith("italic")),
      button("code", t("table.cell_code"), () => formatWith("code")),
      button("link", t("table.cell_link", { key: CELL_MOD }), () => {
        if (!activeInput) return;
        applyOutcome(resolveCellLink(format, activeInput.value, activeInput.selectionStart ?? 0, activeInput.selectionEnd ?? activeInput.value.length));
      })
    );

    // Grupo de estructura
    const structure = document.createElement("div");
    structure.className = "table-editor-tool-group";
    structure.append(
      button("circle-plus", t("table.row_add"), () => {
        const newRow = Array.from({ length: table.header.length }, () => "");
        table.rows.splice(active.row === 0 ? 0 : active.row, 0, newRow);
        dirty = true;
        render({ row: active.row + 1, column: active.column });
      }, { action: "add-row" }),
      button("circle-minus", t("table.row_remove"), () => {
        if (active.row === 0 || table.rows.length === 0) return;
        table.rows.splice(active.row - 1, 1);
        dirty = true;
        render({ row: Math.max(0, active.row - 1), column: active.column });
      }, { action: "remove-row" }),
      button("columns-3", t("table.col_add"), () => {
        const insertAt = active.column + 1;
        table.header.splice(insertAt, 0, `Columna ${table.header.length + 1}`);
        table.alignments.splice(insertAt, 0, "left");
        for (const row of table.rows) row.splice(insertAt, 0, "");
        dirty = true;
        render({ row: active.row, column: insertAt });
      }, { action: "add-column" }),
      button("circle-minus", t("table.col_remove"), () => {
        if (table.header.length <= 1) return;
        table.header.splice(active.column, 1);
        table.alignments.splice(active.column, 1);
        for (const row of table.rows) row.splice(active.column, 1);
        dirty = true;
        render({ row: active.row, column: Math.min(active.column, table.header.length - 1) });
      }, { action: "remove-column" })
    );

    // Grupo de cabeceras
    const headers = document.createElement("div");
    headers.className = "table-editor-tool-group table-editor-headers";
    headers.append(
      button("rows-3", t("table.header_row"), () => {
        table = changeTableHeaderAxis(table, "row");
        headerAxis = "row";
        dirty = true;
        render({ row: 0, column: 0 });
      }, { action: "header-row" }),
      button("columns-3", t("table.header_col"), () => {
        table = changeTableHeaderAxis(table, "column");
        headerAxis = "column";
        dirty = true;
        render({ row: 1, column: 0 });
      }, { action: "header-column" })
    );
    headers.querySelectorAll("button").forEach((btn) => {
      const chosen = btn.dataset.tableAction === `header-${headerAxis}`;
      btn.setAttribute("aria-pressed", String(chosen));
    });

    // Grupo de alineación
    const alignment = document.createElement("div");
    alignment.className = "table-editor-tool-group table-editor-alignment";
    for (const [val, iconName, label] of [
      ["left", "align-left", t("table.align_left")],
      ["center", "align-center", t("table.align_center")],
      ["right", "align-right", t("table.align_right")],
    ]) {
      alignment.append(
        button(iconName, label, () => {
          table.alignments[active.column] = val;
          dirty = true;
          render(active);
        }, { align: val })
      );
    }

    const status = document.createElement("span");
    status.className = "table-editor-status";
    status.setAttribute("aria-live", "polite");

    tools.append(format, structure, headers, alignment, status);

    // Grilla con scroll horizontal
    const scroll = document.createElement("div");
    scroll.className = "table-editor-scroll";
    const grid = document.createElement("table");
    grid.className = "table-editor-grid";
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    const appendRow = (values, r, parent) => {
      const tr = document.createElement("tr");
      values.forEach((value, c) => {
        const isHeader = (headerAxis === "row" && r === 0) || (headerAxis === "column" && c === 0);
        const cell = document.createElement(isHeader ? "th" : "td");
        if (isHeader) cell.setAttribute("scope", headerAxis);
        cell.dataset.align = table.alignments[c] ?? "left";

        const input = document.createElement("textarea");
        input.rows = 1;
        input.className = "table-cell-input";
        input.value = value;
        input.spellcheck = false;
        input.dataset.row = String(r);
        input.dataset.column = String(c);
        input.setAttribute("aria-label", isHeader
          ? (headerAxis === "row" ? `encabezado, columna ${c + 1}` : `encabezado, fila ${r}`)
          : `fila ${r}, columna ${c + 1}`);

        input.addEventListener("focus", () => updateActive(input));
        input.addEventListener("input", () => {
          rowAt(r)[c] = input.value;
          dirty = true;
          fitCellHeight(input);
        });

        // Pegado de tablas de Excel / Sheets / TSV
        input.addEventListener("paste", (e) => {
          const pasted = tabularClipboard(e.clipboardData?.getData("text/plain") ?? "");
          if (!pasted) return;
          e.preventDefault();
          const neededCols = c + Math.max(...pasted.map((row) => row.length));
          while (table.header.length < neededCols) {
            table.header.push(`Columna ${table.header.length + 1}`);
            table.alignments.push("left");
            for (const rList of table.rows) rList.push("");
          }
          const neededRows = r + pasted.length - 1;
          while (table.rows.length < neededRows) {
            table.rows.push(Array.from({ length: table.header.length }, () => ""));
          }
          pasted.forEach((pRow, rOff) =>
            pRow.forEach((content, cOff) => {
              rowAt(r + rOff)[c + cOff] = content;
            })
          );
          dirty = true;
          render({ row: r + pasted.length - 1, column: c + (pasted[pasted.length - 1]?.length ?? 1) - 1 });
        });

        input.addEventListener("keydown", (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
            e.preventDefault(); formatWith("bold"); return;
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
            e.preventDefault(); formatWith("italic"); return;
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            applyOutcome(resolveCellLink(input.value, input.selectionStart ?? 0, input.selectionEnd ?? input.value.length));
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault(); e.stopPropagation();
            options.onClose?.(dirty ? table : null);
            return;
          }
          if (e.key !== "Tab" && e.key !== "Enter") return;
          e.preventDefault();
          const totalRows = table.rows.length + 1;
          if (e.key === "Enter") {
            let nextRow = r + 1;
            if (nextRow >= totalRows) {
              table.rows.push(Array.from({ length: table.header.length }, () => ""));
              dirty = true;
              render({ row: totalRows, column: c });
            } else {
              focus({ row: nextRow, column: c });
            }
            return;
          }
          // Tab / Shift+Tab
          let flat = r * table.header.length + c + (e.shiftKey ? -1 : 1);
          if (flat < 0) flat = 0;
          if (flat >= totalRows * table.header.length) {
            table.rows.push(Array.from({ length: table.header.length }, () => ""));
            dirty = true;
            render({ row: totalRows, column: 0 });
            return;
          }
          focus({ row: Math.floor(flat / table.header.length), column: flat % table.header.length }, true);
        });

        cell.append(input);
        tr.append(cell);
      });
      parent.append(tr);
    };

    if (headerAxis === "row") appendRow(table.header, 0, thead);
    table.rows.forEach((row, idx) => appendRow(row, idx + 1, tbody));
    grid.append(thead, tbody);
    scroll.append(grid);

    // Pie de acciones
    const foot = document.createElement("div");
    foot.className = "table-editor-foot";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-secondary";
    cancelBtn.textContent = t("table.cancel");
    cancelBtn.addEventListener("click", () => options.onClose?.(null));

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "btn-primary";
    doneBtn.innerHTML = `${icon("check")} Guardar tabla`;
    doneBtn.addEventListener("click", () => options.onSave?.(table));

    foot.append(cancelBtn, doneBtn);
    editor.append(tools, scroll, foot);
    host.append(editor);

    host.querySelectorAll(".table-cell-input").forEach(fitCellHeight);
    const target = host.querySelector(
      `.table-cell-input[data-row="${active.row}"][data-column="${active.column}"]`
    );
    if (target) updateActive(target);
    requestAnimationFrame(() => focus(nextFocus ?? active, true));
  };

  render(active);
  return {
    getTable: () => table,
    isDirty: () => dirty,
  };
}

/**
 * Abre el editor de tablas en un modal dedicado accesible y centrado.
 */
export function openTableEditorModal({ table, onSave, onCancel, format = "markdown" }) {
  let modal = document.getElementById("tableModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "tableModal";
    modal.className = "table-modal";
    modal.innerHTML = `
      <div class="table-modal-dialog">
        <div class="table-modal-header">
          <div class="table-modal-title">
            ${icon("grid")} <span>Editor de tabla Markdown</span>
          </div>
          <button type="button" class="table-modal-close" title="${t("table.close")}">${icon("x")}</button>
        </div>
        <div class="table-modal-body"></div>
      </div>
    `;
    document.body.append(modal);

    modal.querySelector(".table-modal-close").addEventListener("click", () => {
      modal.hidden = true;
      onCancel?.();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.hidden = true;
        onCancel?.();
      }
    });
  }

  modal.querySelector(".table-modal-title span").textContent = `Editor de tabla ${formatLabel(format)}`;
  const body = modal.querySelector(".table-modal-body");
  mountMarkdownTableEditor(body, table, {
    format,
    onSave: (updated) => {
      modal.hidden = true;
      onSave?.(updated, normalizeFormat(format) === "wikitext" ? writeWikitextTable(updated) : writeMarkdownTable(updated));
    },
    onClose: () => {
      modal.hidden = true;
      onCancel?.();
    },
  });

  modal.hidden = false;
}
