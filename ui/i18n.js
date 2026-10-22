// Catálogo de interfaz de Luca.
//
// El español es la fuente: se escribe primero, es lo que ve quien no configura
// nada en un sistema en español, y es el respaldo cuando a otro idioma le falta
// una clave. Añadir un idioma es añadir un objeto a CATALOGS con las mismas
// claves; un test comprueba que ninguno se quede corto.
//
// Este módulo es la ÚNICA fuente de texto de interfaz. El menú nativo no tiene
// catálogo propio en Rust: el frontend le envía las etiquetas con menuLabels().
// Los errores que devuelve Rust viajan como claves de este catálogo (err.*),
// opcionalmente con argumentos separados por "|", y t() los resuelve.

export const LANGUAGES = ["es", "en"];
export const AUTO = "auto";

const es = {
  // ---- Menú nativo (las claves que Rust espera en set_menu_labels) ----
  "menu.app.about": "Acerca de Luca",
  "menu.app.prefs": "Preferencias…",
  "menu.file": "Archivo",
  "menu.file.new": "Nuevo",
  "menu.file.open": "Abrir…",
  "menu.file.recent": "Abrir reciente",
  "menu.file.recent_none": "Sin recientes",
  "menu.file.recent_clear": "Vaciar recientes",
  "menu.file.save": "Guardar",
  "menu.file.save_as": "Guardar como…",
  "menu.file.export_pdf": "Exportar (PDF)…",
  "menu.file.close_tab": "Cerrar pestaña",
  "menu.edit": "Edición",
  "menu.edit.select_next": "Seleccionar siguiente aparición",
  "menu.view": "Vista",
  "menu.view.source": "Código fuente",
  "menu.view.split": "Vista dividida",
  "menu.view.rendered": "Texto renderizado",
  "menu.view.outline": "Esquema de encabezados",
  "menu.view.zen": "Modo zen",
  "menu.window": "Ventana",
  "menu.window.new": "Nueva ventana",
  "menu.window.detach": "Mover pestaña a nueva ventana",
  "menu.window.tab_left": "Mover pestaña a la izquierda",
  "menu.window.tab_right": "Mover pestaña a la derecha",
  "menu.window.gather": "Reunir todas las ventanas",
  "menu.help": "Ayuda",
  "menu.help.palette": "Paleta de comandos…",
  "menu.help.shortcuts": "Atajos de teclado",

  // ---- Barra superior ----
  "ui.tabs": "Documentos abiertos",
  "ui.tab.close": "Cerrar",
  "ui.tab.close_named": "Cerrar {name}",
  "ui.tab.untitled": "sin título",
  "ui.tab.unsaved": "sin guardar",
  "ui.outline.button": "Esquema de encabezados (panel lateral)",
  "ui.outline.label": "Esquema de encabezados",
  "ui.outline.empty": "Sin encabezados",
  "ui.outline.divider": "Arrastra para cambiar el ancho del esquema · doble clic: 14 rem",
  "ui.modes": "Modos de visualización",
  "ui.mode.source": "Código fuente",
  "ui.mode.source.title": "Código fuente (Source) · {key}1",
  "ui.mode.split": "Vista dividida",
  "ui.mode.split.title": "Vista dividida (Split) · {key}2",
  "ui.mode.rendered": "Vista previa",
  "ui.mode.rendered.title": "Vista previa (Rendered) · {key}3",
  "ui.theme": "Esquema claro u oscuro",
  "ui.theme.light": "Modo claro",
  "ui.theme.dark": "Modo oscuro",
  "ui.pdf": "Exportar a PDF",
  "ui.pdf.title": "Exportar a PDF · {key}E",
  "ui.zen": "Modo zen",
  "ui.zen.title": "Modo zen (pantalla completa) · {key}⇧Z",
  "ui.zen.exit": "Salir del modo zen · Esc o {key}⇧Z",
  "ui.prefs": "Preferencias",
  "ui.prefs.title": "Preferencias · {key},",
  "ui.divider": "Arrastra para cambiar la proporción · doble clic: 50 %",
  "ui.editor_of": "Editor de {name}",
  "ui.preview_of": "Vista previa de {name}",

  // ---- Barra de estado ----
  "status.bar": "Estado del documento",
  "status.cursor": "Línea {line}, columna {column}",
  "status.encoding": "UTF-8 · {ending}",
  "status.format": "Formato",
  "status.format.auto": "Automático por extensión",
  "status.format.markdown": "Markdown",
  "status.format.wikitext": "Wikitext",
  "status.format.warning": "La extensión no coincide con el formato",
  "status.format.warning.detail":
    "El formato elegido no coincide con la extensión; se guardará sin convertir.",

  // ---- Estado de la vista previa Wikitext ----
  "wiki.status.title": "Vista previa Wikitext · abre las preferencias de wikis",
  "wiki.status.detail": "{label} · {detail}",
  "wiki.status.full": "{text} · {api} · abre las preferencias de wikis",
  "wiki.state.loading": "actualizando…",
  "wiki.state.ok": "vista actual",
  "wiki.state.cache": "en caché · {reason}",
  "wiki.state.unavailable": "sólo en la app",
  "wiki.reason.error": "error: {error}",
  "wiki.reason.offline": "sin conexión: {error}",
  "wiki.notice.browser": "La vista previa Wikitext la produce la wiki: el navegador no puede consultar {api}.",
  "wiki.notice.none": "No hay vista previa de {api} · {reason}",

  // ---- Paleta de comandos y ayuda ----
  "palette.title": "Paleta de comandos",
  "palette.search": "Buscar comandos",
  "palette.placeholder": "Buscar por nombre o atajo…",
  "palette.results": "Comandos disponibles",
  "shortcuts.title": "Atajos de teclado",
  "cmd.new": "Nuevo documento",
  "cmd.new_window": "Nueva ventana",
  "cmd.detach": "Mover pestaña a nueva ventana",
  "cmd.open": "Abrir archivo",
  "cmd.save": "Guardar",
  "cmd.save_as": "Guardar como",
  "cmd.close_tab": "Cerrar pestaña",
  "cmd.find": "Buscar y reemplazar",
  "cmd.select_all_matches": "Seleccionar todas las apariciones",
  "cmd.goto_line": "Ir a línea",
  "cmd.mode_source": "Vista de código",
  "cmd.mode_split": "Vista dividida",
  "cmd.mode_rendered": "Texto renderizado",
  "cmd.zen": "Modo zen",
  "cmd.outline": "Esquema de encabezados",
  "cmd.prefs": "Preferencias",
  "cmd.export_pdf": "Exportar PDF",

  // ---- Preferencias: estructura ----
  "prefs.title": "Preferencias",
  "prefs.back": "Volver a la app",
  "prefs.back.title": "Volver a la app · Esc",
  "prefs.nav": "Categorías de preferencias",
  "prefs.tab.general": "Generales",
  "prefs.tab.wiki": "Wikis",
  "prefs.tab.light": "Tema claro",
  "prefs.tab.dark": "Tema oscuro",

  // ---- Preferencias: idioma ----
  "prefs.language.group": "Idioma",
  "prefs.language.label": "Idioma de la interfaz",
  "prefs.language.auto": "Automático (el del sistema)",
  "prefs.language.es": "Español",
  "prefs.language.en": "English",
  "prefs.language.note":
    "Cambia los rótulos de la interfaz y del menú al instante. No toca el contenido de " +
    "los documentos ni el idioma de la wiki.",

  // ---- Preferencias: diseños ----
  "prefs.design.group": "Diseño",
  "prefs.design.note":
    "Un diseño guarda las tipografías, las medidas y los colores de los temas claro y " +
    "oscuro. Lo que edites aquí y en las pestañas de temas afecta al <strong>diseño " +
    "actual</strong>, el marcado en la lista.",
  "prefs.design.list": "Diseños guardados",
  "prefs.design.name": "Nombre del diseño actual",
  "prefs.design.name.placeholder": "Mi diseño",
  "prefs.design.add": "Nuevo",
  "prefs.design.add.title": "Crea un diseño con los valores predeterminados",
  "prefs.design.duplicate": "Duplicar",
  "prefs.design.duplicate.title": "Copia el diseño actual con otro nombre",
  "prefs.design.remove": "Eliminar",
  "prefs.design.remove.title": "Elimina el diseño actual",
  "prefs.design.new_name": "Diseño",
  "prefs.design.copy_suffix": "{name} copia",
  "prefs.import": "Importar diseño…",
  "prefs.import.title": "Añade a la lista un diseño guardado en un archivo JSON",
  "prefs.export": "Exportar diseño…",
  "prefs.export.title": "Guarda el diseño actual en un archivo JSON",
  "prefs.reset": "Restaurar valores predeterminados",
  "prefs.reset.title": "Devuelve el diseño actual a las tipografías, medidas y colores de fábrica",
  "prefs.tokens.group": "Tipografías y medidas del diseño actual",
  "prefs.palette.note": "Paleta de colores para el tema {theme}",
  "prefs.theme.light": "claro",
  "prefs.theme.dark": "oscuro",
  "prefs.font.custom": "Personalizada",

  // ---- Preferencias: diagramas y soporte ----
  "prefs.diagrams.group": "Diagramas",
  "prefs.mermaid.theme": "Tema de Mermaid",
  "prefs.mermaid.vera": "Vera (tokenizado)",
  "prefs.mermaid.neutral": "Neutral",
  "prefs.mermaid.default": "Default",
  "prefs.mermaid.forest": "Forest",
  "prefs.mermaid.dark": "Dark",
  "prefs.support.group": "Soporte",
  "prefs.support.note":
    "Un informe técnico para adjuntar al reportar un error: versión, plataforma, versión " +
    "del esquema de preferencias, capacidades y cuántas pestañas hay abiertas por estado " +
    "y formato. No incluye el contenido de los documentos, sus nombres o rutas, los " +
    "recientes, la URL de la wiki ni credenciales.",
  "prefs.support.diagnostic": "Informe técnico para reportar un error…",

  // ---- Preferencias: wikis ----
  "prefs.wiki.group": "Renderizador de Wikitext",
  "prefs.wiki.note":
    "Luca no interpreta Wikitext: las plantillas, las consultas semánticas y las " +
    "extensiones sólo existen en la wiki de destino. La vista previa se la pide a esa " +
    "wiki con <code>action=parse</code>, sin escribir nada y sin reutilizar sesiones del " +
    "navegador.",
  "prefs.wiki.server": "Servidor activo",
  "prefs.wiki.context": "Título de contexto",
  "prefs.wiki.context.placeholder": "Se infiere del archivo",
  "prefs.wiki.saved.group": "Servidores guardados",
  "prefs.wiki.name": "Nombre",
  "prefs.wiki.name.placeholder": "Wikipedia (es)",
  "prefs.wiki.api": "Endpoint api.php",
  "prefs.wiki.api.placeholder": "https://es.wikipedia.org/w/api.php",
  "prefs.wiki.add": "Guardar servidor",
  "prefs.wiki.remove": "Eliminar el activo",
  "prefs.wiki.styles.group": "Estilos de la wiki",
  "prefs.wiki.styles": "Previsualizar con las CSS de la wiki",
  "prefs.wiki.styles.note":
    "Trae <code>site.styles</code>, los estilos de la skin de la wiki y los módulos que " +
    "declara el parseo, y los aplica aislados del resto de Luca: la vista previa se " +
    "parece a la wiki y los tokens de diseño dejan de gobernarla. Apágalo para volver a " +
    "leer con la tipografía de Luca.",
  "prefs.wiki.modules": "Módulos extra",
  "prefs.wiki.modules.placeholder": "skins.vector.styles, ext.smw.style",
  "prefs.wiki.server.option": "{name} · {api}",

  // ---- Tokens de diseño ----
  "token.group.code": "Código",
  "token.group.read": "Lectura (vista previa)",
  "token.group.ui": "Interfaz",
  "token.group.app": "Entorno general",
  "token.group.editor": "Editor de código (Code)",
  "token.group.preview": "Vista previa / Lectura (Preview)",
  "token.font": "Fuente",
  "token.text_size": "Tamaño de texto",
  "token.column_width": "Ancho de columna",
  "token.line_height": "Interlínea",
  "token.font.body": "Cuerpo general",
  "token.font.ui": "Interfaz",
  "token.bg": "Fondo de aplicación",
  "token.bg_raised": "Fondo barras / paneles",
  "token.text": "Texto de aplicación",
  "token.text_dim": "Texto tenue / metadatos",
  "token.rule": "Líneas divisorias y bordes",
  "token.accent": "Color de acento (también enlaces y énfasis)",
  "token.code_bg": "Fondo del editor de código",
  "token.code_text": "Texto del editor de código",
  "token.preview_bg": "Fondo de vista previa",
  "token.preview_text": "Texto de vista previa",

  // ---- Barra de herramientas ----
  "toolbar.label": "Herramientas de edición de código",
  "toolbar.bold": "Negrita",
  "toolbar.italic": "Cursiva",
  "toolbar.strike": "Tachado",
  "toolbar.underline": "Subrayado",
  "toolbar.code_inline": "Código en línea",
  "toolbar.superscript": "Superíndice",
  "toolbar.subscript": "Subíndice",
  "toolbar.heading1": "Encabezado nivel 1 (#)",
  "toolbar.heading_more": "Más niveles de encabezado",
  "toolbar.paragraph": "Párrafo normal (sin encabezado)",
  "toolbar.bullets": "Lista con viñetas",
  "toolbar.numbered": "Lista numerada",
  "toolbar.tasks": "Lista de tareas",
  "toolbar.quote": "Cita",
  "toolbar.code_block": "Bloque de código",
  "toolbar.code_block.md": "Bloque de código (```)",
  "toolbar.code_block.wiki": "Bloque de código (<pre>)",
  "toolbar.link.md": "Enlace Markdown ([texto](url))",
  "toolbar.link.external": "Enlace externo",
  "toolbar.link.external.wiki": "Enlace externo ([url texto])",
  "toolbar.link.internal": "Enlace interno ([[página]])",
  "toolbar.table": "Editor de tabla",

  // ---- Editor de tablas ----
  "table.edit": "Editar visualmente esta tabla",
  "table.close": "Cerrar (Esc)",
  "table.cancel": "Cancelar",
  "table.row_add": "Añadir fila abajo",
  "table.row_remove": "Eliminar fila actual",
  "table.col_add": "Añadir columna a la derecha",
  "table.col_remove": "Eliminar columna actual",
  "table.align_left": "Alinear a la izquierda",
  "table.align_center": "Centrar columna",
  "table.align_right": "Alinear a la derecha",
  "table.header_row": "Primera fila como cabecera",
  "table.header_col": "Primera columna como cabecera",
  "table.cell_bold": "Negrita en celda ({key}B)",
  "table.cell_italic": "Cursiva en celda ({key}I)",
  "table.cell_code": "Código en celda",
  "table.cell_link": "Enlace en celda ({key}K)",

  // ---- Acerca de ----
  "about.title": "Luca",
  "about.version": "versión {version}",
  "about.version.dev": "versión de desarrollo",
  "about.tagline": "Un editor Markdown y Wikitext para pensar y escribir con archivos propios.",
  "about.credit": "Iniciativa de MediaFranca creada por Herbert Spencer.",
  "about.name":
    "Su nombre y su letra capital L recuerdan a Luca Pacioli y la construcción geométrica " +
    "de las letras en",
  "about.divina": "Divina proportione",
  "about.casiopea": "Casiopea",
  "about.github": "GitHub",
  "about.license": "· EUPL 1.2",
  "about.close": "Cerrar",
  "about.icon": "Letra capital L de Luca",

  // ---- Diálogos ----
  "dialog.recent_failed": "No se pudo abrir el archivo reciente:\n{path}",
  "dialog.external_change": "El archivo cambió fuera de luca. ¿Sobrescribir?",
  "dialog.unsaved": "\"{name}\" tiene cambios sin guardar. ¿Cerrar igual?",
  "dialog.design.last": "Debe quedar al menos un diseño.",
  "dialog.design.remove": "¿Eliminar el diseño \"{name}\"? No se puede deshacer.",
  "dialog.design.invalid": "El archivo no contiene un diseño de Luca válido.",
  "dialog.wiki.invalid": "El endpoint de la wiki debe ser una URL HTTPS que termine en api.php.",
  "dialog.wiki.last": "Debe quedar al menos una wiki para la vista previa Wikitext.",
  "dialog.filter.markup": "Texto marcado",
  "dialog.filter.design": "Diseño de Luca",
  "dialog.filter.diagnostic": "Diagnóstico de Luca",
  "dialog.untitled_file": "sin título",

  // ---- Vista previa ----
  "preview.asset_blocked": "Recurso local no disponible o no permitido",
  "preview.mermaid_error": "⚠ Mermaid: {error}",

  // ---- Errores que devuelve Rust (claves, no prosa) ----
  "err.asset.not_media": "El recurso local no es un formato multimedia permitido",
  "err.asset.no_extension": "El recurso local no tiene una extensión multimedia",
  "err.wiki.url": "La dirección de la wiki no es válida",
  "err.wiki.not_https": "La API de la wiki debe usar HTTPS y no incluir credenciales",
  "err.wiki.too_large": "La respuesta de la wiki excede el límite de tamaño",
  "err.wiki.http": "La wiki respondió HTTP {0}",
  "err.wiki.unreachable": "No se pudo contactar la wiki: {0}",
  "err.wiki.invalid_json": "Respuesta inválida de MediaWiki",
  "err.wiki.no_html": "MediaWiki no devolvió HTML",
  "err.wiki.api": "MediaWiki rechazó la consulta: {0}",
  "err.styles.unreachable": "No se pudieron traer los estilos: {0}",
  "err.styles.not_css": "La wiki no devolvió CSS",
  "err.styles.no_modules": "Sin módulos de estilo que pedir",
  "err.styles.not_utf8": "Los estilos no son UTF-8",
  "err.window.gone": "La ventana de destino ya no existe",
  "err.print.unsupported": "sin impresión nativa en esta plataforma",
};

const en = {
  // ---- Native menu ----
  "menu.app.about": "About Luca",
  "menu.app.prefs": "Settings…",
  "menu.file": "File",
  "menu.file.new": "New",
  "menu.file.open": "Open…",
  "menu.file.recent": "Open Recent",
  "menu.file.recent_none": "No recent files",
  "menu.file.recent_clear": "Clear Recent",
  "menu.file.save": "Save",
  "menu.file.save_as": "Save As…",
  "menu.file.export_pdf": "Export (PDF)…",
  "menu.file.close_tab": "Close Tab",
  "menu.edit": "Edit",
  "menu.edit.select_next": "Select Next Occurrence",
  "menu.view": "View",
  "menu.view.source": "Source",
  "menu.view.split": "Split View",
  "menu.view.rendered": "Rendered Text",
  "menu.view.outline": "Heading Outline",
  "menu.view.zen": "Zen Mode",
  "menu.window": "Window",
  "menu.window.new": "New Window",
  "menu.window.detach": "Move Tab to New Window",
  "menu.window.tab_left": "Move Tab Left",
  "menu.window.tab_right": "Move Tab Right",
  "menu.window.gather": "Gather All Windows",
  "menu.help": "Help",
  "menu.help.palette": "Command Palette…",
  "menu.help.shortcuts": "Keyboard Shortcuts",

  // ---- Top bar ----
  "ui.tabs": "Open documents",
  "ui.tab.close": "Close",
  "ui.tab.close_named": "Close {name}",
  "ui.tab.untitled": "untitled",
  "ui.tab.unsaved": "unsaved",
  "ui.outline.button": "Heading outline (side panel)",
  "ui.outline.label": "Heading outline",
  "ui.outline.empty": "No headings",
  "ui.outline.divider": "Drag to resize the outline · double-click: 14 rem",
  "ui.modes": "View modes",
  "ui.mode.source": "Source",
  "ui.mode.source.title": "Source · {key}1",
  "ui.mode.split": "Split view",
  "ui.mode.split.title": "Split view · {key}2",
  "ui.mode.rendered": "Preview",
  "ui.mode.rendered.title": "Preview (rendered) · {key}3",
  "ui.theme": "Light or dark scheme",
  "ui.theme.light": "Light mode",
  "ui.theme.dark": "Dark mode",
  "ui.pdf": "Export to PDF",
  "ui.pdf.title": "Export to PDF · {key}E",
  "ui.zen": "Zen mode",
  "ui.zen.title": "Zen mode (full screen) · {key}⇧Z",
  "ui.zen.exit": "Leave zen mode · Esc or {key}⇧Z",
  "ui.prefs": "Settings",
  "ui.prefs.title": "Settings · {key},",
  "ui.divider": "Drag to change the proportion · double-click: 50 %",
  "ui.editor_of": "Editor for {name}",
  "ui.preview_of": "Preview of {name}",

  // ---- Status bar ----
  "status.bar": "Document status",
  "status.cursor": "Line {line}, column {column}",
  "status.encoding": "UTF-8 · {ending}",
  "status.format": "Format",
  "status.format.auto": "Automatic by extension",
  "status.format.markdown": "Markdown",
  "status.format.wikitext": "Wikitext",
  "status.format.warning": "The extension does not match the format",
  "status.format.warning.detail":
    "The chosen format does not match the extension; it will be saved without converting.",

  // ---- Wikitext preview status ----
  "wiki.status.title": "Wikitext preview · opens the wiki settings",
  "wiki.status.detail": "{label} · {detail}",
  "wiki.status.full": "{text} · {api} · opens the wiki settings",
  "wiki.state.loading": "updating…",
  "wiki.state.ok": "current",
  "wiki.state.cache": "cached · {reason}",
  "wiki.state.unavailable": "app only",
  "wiki.reason.error": "error: {error}",
  "wiki.reason.offline": "offline: {error}",
  "wiki.notice.browser": "The Wikitext preview comes from the wiki: the browser cannot query {api}.",
  "wiki.notice.none": "No preview from {api} · {reason}",

  // ---- Command palette and help ----
  "palette.title": "Command palette",
  "palette.search": "Search commands",
  "palette.placeholder": "Search by name or shortcut…",
  "palette.results": "Available commands",
  "shortcuts.title": "Keyboard shortcuts",
  "cmd.new": "New document",
  "cmd.new_window": "New window",
  "cmd.detach": "Move tab to new window",
  "cmd.open": "Open file",
  "cmd.save": "Save",
  "cmd.save_as": "Save as",
  "cmd.close_tab": "Close tab",
  "cmd.find": "Find and replace",
  "cmd.select_all_matches": "Select all occurrences",
  "cmd.goto_line": "Go to line",
  "cmd.mode_source": "Source view",
  "cmd.mode_split": "Split view",
  "cmd.mode_rendered": "Rendered text",
  "cmd.zen": "Zen mode",
  "cmd.outline": "Heading outline",
  "cmd.prefs": "Settings",
  "cmd.export_pdf": "Export PDF",

  // ---- Settings: structure ----
  "prefs.title": "Settings",
  "prefs.back": "Back to the app",
  "prefs.back.title": "Back to the app · Esc",
  "prefs.nav": "Settings categories",
  "prefs.tab.general": "General",
  "prefs.tab.wiki": "Wikis",
  "prefs.tab.light": "Light theme",
  "prefs.tab.dark": "Dark theme",

  // ---- Settings: language ----
  "prefs.language.group": "Language",
  "prefs.language.label": "Interface language",
  "prefs.language.auto": "Automatic (system)",
  "prefs.language.es": "Español",
  "prefs.language.en": "English",
  "prefs.language.note":
    "Changes the interface and menu labels right away. It does not touch document " +
    "content or the wiki's language.",

  // ---- Settings: designs ----
  "prefs.design.group": "Design",
  "prefs.design.note":
    "A design holds the typefaces, the measures and the colours of both the light and " +
    "dark themes. What you edit here and in the theme tabs applies to the <strong>current " +
    "design</strong>, the one marked in the list.",
  "prefs.design.list": "Saved designs",
  "prefs.design.name": "Name of the current design",
  "prefs.design.name.placeholder": "My design",
  "prefs.design.add": "New",
  "prefs.design.add.title": "Creates a design with the default values",
  "prefs.design.duplicate": "Duplicate",
  "prefs.design.duplicate.title": "Copies the current design under another name",
  "prefs.design.remove": "Delete",
  "prefs.design.remove.title": "Deletes the current design",
  "prefs.design.new_name": "Design",
  "prefs.design.copy_suffix": "{name} copy",
  "prefs.import": "Import design…",
  "prefs.import.title": "Adds a design saved in a JSON file to the list",
  "prefs.export": "Export design…",
  "prefs.export.title": "Saves the current design to a JSON file",
  "prefs.reset": "Restore default values",
  "prefs.reset.title": "Returns the current design to the factory typefaces, measures and colours",
  "prefs.tokens.group": "Typefaces and measures of the current design",
  "prefs.palette.note": "Colour palette for the {theme} theme",
  "prefs.theme.light": "light",
  "prefs.theme.dark": "dark",
  "prefs.font.custom": "Custom",

  // ---- Settings: diagrams and support ----
  "prefs.diagrams.group": "Diagrams",
  "prefs.mermaid.theme": "Mermaid theme",
  "prefs.mermaid.vera": "Vera (tokenised)",
  "prefs.mermaid.neutral": "Neutral",
  "prefs.mermaid.default": "Default",
  "prefs.mermaid.forest": "Forest",
  "prefs.mermaid.dark": "Dark",
  "prefs.support.group": "Support",
  "prefs.support.note":
    "A technical report to attach when reporting a bug: version, platform, settings " +
    "schema version, capabilities and how many tabs are open by state and format. It " +
    "does not include document contents, their names or paths, the recent files, the " +
    "wiki URL or any credentials.",
  "prefs.support.diagnostic": "Technical report for a bug report…",

  // ---- Settings: wikis ----
  "prefs.wiki.group": "Wikitext renderer",
  "prefs.wiki.note":
    "Luca does not interpret Wikitext: templates, semantic queries and extensions only " +
    "exist on the target wiki. The preview is requested from that wiki with " +
    "<code>action=parse</code>, writing nothing and reusing no browser session.",
  "prefs.wiki.server": "Active server",
  "prefs.wiki.context": "Context title",
  "prefs.wiki.context.placeholder": "Inferred from the file",
  "prefs.wiki.saved.group": "Saved servers",
  "prefs.wiki.name": "Name",
  "prefs.wiki.name.placeholder": "Wikipedia (en)",
  "prefs.wiki.api": "api.php endpoint",
  "prefs.wiki.api.placeholder": "https://en.wikipedia.org/w/api.php",
  "prefs.wiki.add": "Save server",
  "prefs.wiki.remove": "Delete the active one",
  "prefs.wiki.styles.group": "Wiki styles",
  "prefs.wiki.styles": "Preview with the wiki's CSS",
  "prefs.wiki.styles.note":
    "Fetches <code>site.styles</code>, the wiki's skin styles and the modules the parse " +
    "declares, and applies them isolated from the rest of Luca: the preview looks like " +
    "the wiki and the design tokens stop governing it. Turn it off to read with Luca's " +
    "own typography again.",
  "prefs.wiki.modules": "Extra modules",
  "prefs.wiki.modules.placeholder": "skins.vector.styles, ext.smw.style",
  "prefs.wiki.server.option": "{name} · {api}",

  // ---- Design tokens ----
  "token.group.code": "Code",
  "token.group.read": "Reading (preview)",
  "token.group.ui": "Interface",
  "token.group.app": "General environment",
  "token.group.editor": "Code editor",
  "token.group.preview": "Preview / Reading",
  "token.font": "Typeface",
  "token.text_size": "Text size",
  "token.column_width": "Column width",
  "token.line_height": "Line height",
  "token.font.body": "General body",
  "token.font.ui": "Interface",
  "token.bg": "Application background",
  "token.bg_raised": "Bars / panels background",
  "token.text": "Application text",
  "token.text_dim": "Dim text / metadata",
  "token.rule": "Dividers and borders",
  "token.accent": "Accent colour (also links and emphasis)",
  "token.code_bg": "Code editor background",
  "token.code_text": "Code editor text",
  "token.preview_bg": "Preview background",
  "token.preview_text": "Preview text",

  // ---- Toolbar ----
  "toolbar.label": "Code editing tools",
  "toolbar.bold": "Bold",
  "toolbar.italic": "Italic",
  "toolbar.strike": "Strikethrough",
  "toolbar.underline": "Underline",
  "toolbar.code_inline": "Inline code",
  "toolbar.superscript": "Superscript",
  "toolbar.subscript": "Subscript",
  "toolbar.heading1": "Heading level 1 (#)",
  "toolbar.heading_more": "More heading levels",
  "toolbar.paragraph": "Normal paragraph (no heading)",
  "toolbar.bullets": "Bulleted list",
  "toolbar.numbered": "Numbered list",
  "toolbar.tasks": "Task list",
  "toolbar.quote": "Quote",
  "toolbar.code_block": "Code block",
  "toolbar.code_block.md": "Code block (```)",
  "toolbar.code_block.wiki": "Code block (<pre>)",
  "toolbar.link.md": "Markdown link ([text](url))",
  "toolbar.link.external": "External link",
  "toolbar.link.external.wiki": "External link ([url text])",
  "toolbar.link.internal": "Internal link ([[page]])",
  "toolbar.table": "Table editor",

  // ---- Table editor ----
  "table.edit": "Edit this table visually",
  "table.close": "Close (Esc)",
  "table.cancel": "Cancel",
  "table.row_add": "Add row below",
  "table.row_remove": "Delete current row",
  "table.col_add": "Add column to the right",
  "table.col_remove": "Delete current column",
  "table.align_left": "Align left",
  "table.align_center": "Centre column",
  "table.align_right": "Align right",
  "table.header_row": "First row as header",
  "table.header_col": "First column as header",
  "table.cell_bold": "Bold in cell ({key}B)",
  "table.cell_italic": "Italic in cell ({key}I)",
  "table.cell_code": "Code in cell",
  "table.cell_link": "Link in cell ({key}K)",

  // ---- About ----
  "about.title": "Luca",
  "about.version": "version {version}",
  "about.version.dev": "development build",
  "about.tagline": "A Markdown and Wikitext editor for thinking and writing in your own files.",
  "about.credit": "A MediaFranca initiative created by Herbert Spencer.",
  "about.name":
    "Its name and its capital L recall Luca Pacioli and the geometric construction of " +
    "letters in",
  "about.divina": "Divina proportione",
  "about.casiopea": "Casiopea",
  "about.github": "GitHub",
  "about.license": "· EUPL 1.2",
  "about.close": "Close",
  "about.icon": "Luca's capital letter L",

  // ---- Dialogs ----
  "dialog.recent_failed": "Could not open the recent file:\n{path}",
  "dialog.external_change": "The file changed outside luca. Overwrite?",
  "dialog.unsaved": "\"{name}\" has unsaved changes. Close anyway?",
  "dialog.design.last": "At least one design must remain.",
  "dialog.design.remove": "Delete the design \"{name}\"? This cannot be undone.",
  "dialog.design.invalid": "The file does not contain a valid Luca design.",
  "dialog.wiki.invalid": "The wiki endpoint must be an HTTPS URL ending in api.php.",
  "dialog.wiki.last": "At least one wiki must remain for the Wikitext preview.",
  "dialog.filter.markup": "Marked-up text",
  "dialog.filter.design": "Luca design",
  "dialog.filter.diagnostic": "Luca diagnostic",
  "dialog.untitled_file": "untitled",

  // ---- Preview ----
  "preview.asset_blocked": "Local resource unavailable or not allowed",
  "preview.mermaid_error": "⚠ Mermaid: {error}",

  // ---- Errors returned by Rust ----
  "err.asset.not_media": "The local resource is not an allowed media format",
  "err.asset.no_extension": "The local resource has no media extension",
  "err.wiki.url": "The wiki address is not valid",
  "err.wiki.not_https": "The wiki API must use HTTPS and carry no credentials",
  "err.wiki.too_large": "The wiki response exceeds the size limit",
  "err.wiki.http": "The wiki answered HTTP {0}",
  "err.wiki.unreachable": "Could not reach the wiki: {0}",
  "err.wiki.invalid_json": "Invalid response from MediaWiki",
  "err.wiki.no_html": "MediaWiki returned no HTML",
  "err.wiki.api": "MediaWiki rejected the query: {0}",
  "err.styles.unreachable": "Could not fetch the styles: {0}",
  "err.styles.not_css": "The wiki returned no CSS",
  "err.styles.no_modules": "No style modules to request",
  "err.styles.not_utf8": "The styles are not UTF-8",
  "err.window.gone": "The target window no longer exists",
  "err.print.unsupported": "no native printing on this platform",
};

export const CATALOGS = { es, en };

// Un sistema en español lee en español; cualquier otro lee en inglés, que llega
// más lejos que mostrarle español a quien no lo habla.
export function detectLanguage(tags = []) {
  for (const tag of tags) {
    const base = String(tag || "").toLowerCase().split("-")[0];
    if (CATALOGS[base]) return base;
  }
  return "en";
}

let current = "es";

export const language = () => current;

export function setLanguage(lang) {
  current = CATALOGS[lang] ? lang : "es";
  return current;
}

const fill = (text, params) =>
  params ? text.replace(/\{(\w+)\}/g, (whole, key) => (params[key] ?? whole)) : text;

// t() acepta tanto una clave ("prefs.title") como una clave con argumentos
// posicionales ("err.wiki.http|404"), que es la forma en que Rust devuelve sus
// errores. Lo que no sea una clave conocida se devuelve tal cual: así un error
// del sistema operativo o de la red sigue siendo legible aunque no esté en el
// catálogo.
export function t(key, params) {
  const [plain, ...args] = String(key ?? "").split("|");
  const text = CATALOGS[current][plain] ?? CATALOGS.es[plain];
  if (text === undefined) return String(key ?? "");
  const positional = args.length ? Object.fromEntries(args.map((v, i) => [i, v])) : null;
  return fill(fill(text, params), positional);
}

// Las etiquetas que Rust necesita para armar el menú nativo. Rust no traduce
// nada: recibe esto y lo usa tal cual.
export const MENU_KEYS = Object.keys(es).filter((key) => key.startsWith("menu."));

export const menuLabels = () =>
  Object.fromEntries(MENU_KEYS.map((key) => [key.slice("menu.".length), t(key)]));

// Aplica el catálogo al DOM ya cargado. data-i18n pone textContent;
// data-i18n-html pone innerHTML (para las notas que llevan <code> o <strong>,
// que son contenido nuestro, no del autor); los demás ponen su atributo.
const ATTRS = [
  ["data-i18n-title", "title", "i18nTitle"],
  ["data-i18n-aria-label", "aria-label", "i18nAriaLabel"],
  ["data-i18n-placeholder", "placeholder", "i18nPlaceholder"],
  ["data-i18n-alt", "alt", "i18nAlt"],
];

export function translatePage(root = document, params = {}) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n, params);
  }
  for (const el of root.querySelectorAll("[data-i18n-html]")) {
    el.innerHTML = t(el.dataset.i18nHtml, params);
  }
  for (const [selector, attr, prop] of ATTRS) {
    for (const el of root.querySelectorAll(`[${selector}]`)) {
      el.setAttribute(attr, t(el.dataset[prop], params));
    }
  }
}
