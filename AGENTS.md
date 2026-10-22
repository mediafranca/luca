# Guía para agentes — Luca

Luca es un editor Markdown local del ecosistema MediaFranca, pensado para
elaborar textos que luego se publican en Vera. Usa Tauri 2, Rust y un frontend
HTML/CSS/JavaScript sin framework. Lee `README.md` y `CONTRIBUTING.md` como contexto.

## Alcance y trabajo compartido

- Revisa `git status --short` antes de editar. Puede haber otro agente trabajando
  en el mismo checkout; conserva sus cambios y limita el diff a lo solicitado.
- Una autorización para documentación o assets no autoriza cambios de código.
  No reformatees, limpies archivos ni reviertas cambios ajenos como tarea lateral.
- Prefiere cambios pequeños, patrones existentes y dependencias ya instaladas.
- Mantén la documentación y los mensajes de interfaz en español.

## Descubrimiento del código

<!-- codebase-memory-mcp:start -->
Este proyecto usa codebase-memory-mcp. Para explorar código, usa primero el grafo:

1. `list_projects`: identifica el proyecto por su ruta; no asumas el nombre del índice.
2. Si no está indexado, ejecuta `index_repository` para este repositorio.
3. `get_architecture`: estructura, entradas y relaciones principales.
4. `search_graph`: símbolos por nombre o consulta; revisa `has_more` al paginar.
5. `trace_path`: llamadas entrantes/salientes antes de cambiar una función compartida.
6. `get_code_snippet`: fuente de un símbolo; `search_code`: búsqueda textual en código.
7. `query_graph`: consultas estructurales más complejas.

Usa los parámetros que exponga la herramienta instalada. El grafo puede estar
incompleto o desactualizado: contrasta con el archivo actual antes de editar.
Puedes usar `rg` y lectura directa para documentación, configuración y otros
archivos no indexados, o si el grafo no devuelve información suficiente.
<!-- codebase-memory-mcp:end -->

## Mapa de fuentes

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `ui/app.js` | Documentos y pestañas, apertura/guardado, preview Markdown/Mermaid, modos, preferencias e IPC con Tauri. |
| `ui/editor.src.js` | `createMarkdownEditor`, API del editor CodeMirror 6, temas y medición tipográfica. Se empaqueta; no se importa directamente en el navegador. |
| `ui/block-edit.js` | Edición por bloques en la vista renderizada: abre un bloque con su Markdown in situ, sincroniza su rango con el documento y lo cierra. |
| `ui/toolbar.js`, `ui/table-editor.js` | Barra de herramientas y editor visual de tablas. Leen `doc.format` en cada acción y emiten Markdown o Wikitext. |
| `ui/format-syntax.js` | Sintaxis por formato (inline, encabezados, listas, bloques, enlaces). Módulo puro con tests en Node. |
| `ui/markdown-table.js`, `ui/wikitext-table.js` | Lectura y escritura de tablas Markdown (`\|`) y Wikitext (`{\| … \|}`) sobre el mismo modelo. |
| `ui/index.html` | DOM, estilos, tokens de Vera, fuentes locales, modos source/split/rendered, zen e impresión. |
| `src-tauri/src/main.rs` | I/O de archivos, mtime, menú nativo y apertura desde el sistema. |
| `src-tauri/tauri.conf.json` | Empaquetado, CSP, ventana, asociación `.md`/`.markdown` y hooks de desarrollo. `dangerousDisableAssetCspModification: ["style-src"]` es imprescindible: sin él Tauri añade hashes a `style-src`, `'unsafe-inline'` deja de valer y los `<style>` que inyectan CodeMirror y Mermaid quedan bloqueados. |
| `src-tauri/capabilities/default.json` | Permisos de la ventana principal y diálogos. |
| `scripts/vendor.mjs` | Copia las dependencias runtime locales y empaqueta CodeMirror con esbuild. |
| `specs/*.allium` | Contratos de comportamiento: raíz, documentos, preview e integración con Vera. |
| `icon.png`, `src-tauri/icons/` | Fuente del ícono y variantes por plataforma. |
| `ui/fonts/`, `assets/` | Fuentes y recursos gráficos con sus licencias y atribuciones. |

## Contratos que hay que preservar

- El Markdown del editor es la fuente de verdad. Guarda el texto sin normalizarlo,
  inyectar IDs/metadatos de Vera ni sustituir los fences Mermaid por SVG.
- Preserva sintaxis desconocida, incluido YAML y líneas `clave:: valor`.
- Abrir añade una pestaña; reabrir la misma ruta activa la existente. Cada documento
  conserva su editor, historial, cursor y scroll. Siempre queda un documento activo.
- Pide confirmación antes de descartar cambios de una pestaña. Mantén el guardado
  mediante temporal y reemplazo y la comprobación de mtime antes de sobrescribir.
- Luca no borra los borradores ni escribe en el grafo de Vera. La integración
  definida en v1 usa asociaciones de archivo; no añadas deep-links o RPC sin un requisito.
- La vista previa es una proyección. Mantén los recursos locales de marked,
  Mermaid y sus motores ELK, tidy-tree y ZenUML; el CDN es respaldo.
- Conserva los tokens CSS compartidos por interfaz, CodeMirror y Mermaid,
  claro/oscuro, fuentes locales y la medición tras cargar fuentes.
- Los menús nativos emiten `menu`; las aperturas desde el sistema o una segunda
  instancia emiten `launch-request` y el frontend consulta `take_opened_files`.
  Si cambias estos contratos, revisa ambos lados.
- Si cambia el comportamiento observable, actualiza la spec correspondiente.
  Una garantía escrita en la spec no prueba que esté implementada: señala las
  discrepancias encontradas sin ampliar por tu cuenta el alcance de la tarea.

## Desarrollo y verificación

Necesitas Node.js, Rust y la CLI de Tauri 2. Desde la raíz:

```sh
npm install
npm run vendor
cargo tauri dev
cargo tauri build
```

Los hooks de Tauri ejecutan `npm run vendor`. El script reconstruye siempre
`ui/vendor/` porque la carpeta no se versiona y puede pertenecer a una revisión
anterior. Para regenerarla manualmente usa:

```sh
npm run vendor
```

- JavaScript: `node --check ui/app.js`, `node --check ui/editor.src.js` y
  `node --check scripts/vendor.mjs` comprueban sintaxis, no comportamiento.
- Rust: `cargo check --manifest-path src-tauri/Cargo.toml` comprueba compilación.
- Specs: `allium check specs/` cuando esté instalada la CLI de Allium.
- No hay un script `npm test` ni una suite de tests propia en el árbol revisado.
  Para lógica nueva, añade una prueba pequeña adecuada al cambio sin montar
  infraestructura innecesaria.
- Comprueba manualmente los flujos afectados en Tauri: nuevo/abrir/reabrir,
  alternar pestañas, guardar/guardar como, cancelar cierre con cambios y detectar
  edición externa. Usa archivos temporales, nunca borradores reales como fixtures.
- Para cambios de preview o presentación, verifica Mermaid offline, errores de
  diagramas, claro/oscuro, modos, zen e impresión del documento activo según aplique.
- Una prueba en navegador no verifica diálogos, menú, I/O ni apertura del sistema.
  Informa qué ejecutaste y qué quedó sin comprobar; no declares éxito por inspección.

## Generados y assets

- `ui/vendor/`, `node_modules/` y `src-tauri/target/` son salidas/dependencias:
  no las edites a mano ni las incluyas como código fuente.
- `src-tauri/gen/schemas/` contiene esquemas generados de Tauri. Cambia las
  configuraciones fuente, no los esquemas como solución a un problema de permisos.
- Hay artefactos de una compilación Swift en `.build/`, incluso versionados.
  La ruta de desarrollo documentada es Tauri: no los uses como fuentes ni los
  borres/desversiones sin una tarea explícita de limpieza.
- Para un cambio de ícono, conserva el arte aprobado y limita la modificación a
  los assets. El comando documentado para regenerar variantes es
  `cargo tauri icon icon.png`; revisa el diff y los tamaños generados.
- Conserva avisos de licencia de las fuentes, atribución del puño alzado y EUPL 1.2.

<claude-mem-context>
# Memory Context

# claude-mem status

This project has no memory yet. The current session will seed it; subsequent sessions will receive auto-injected context for relevant past work.

Memory injection starts on your second session in a project.

`/learn-codebase` is available if the user wants to front-load the entire repo into memory in a single pass (~5 minutes on a typical repo, optional). Otherwise memory builds passively as work happens.

Live activity: http://localhost:37701
How it works: `/how-it-works`

This message disappears once the first observation lands.
</claude-mem-context>
