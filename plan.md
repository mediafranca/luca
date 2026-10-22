# Plan de evolución de Luca

Este documento mantiene la dirección de producto y el trabajo pendiente de
Luca. No sustituye las especificaciones Allium: el plan explica **por qué y en
qué orden** evolucionará el producto; las specs fijan el comportamiento
observable de cada cambio antes de implementarlo.

## Propósito

Luca es una iniciativa de **MediaFranca**, creada por **Herbert Spencer**: un
editor de archivos de texto para pensar y escribir con lenguajes de marcado
legibles. Debe seguir siendo pequeño, local, rápido y comprensible. No pretende
convertirse en un IDE, un navegador, un gestor de conocimiento ni una segunda
Vera.

Principios rectores:

- el archivo de la persona es la fuente de verdad;
- abrir y guardar no normaliza ni reescribe contenido silenciosamente;
- cada función importante es encontrable en la interfaz y accesible por teclado;
- la vista previa es una proyección, nunca el documento canónico;
- la integración con servicios externos es explícita y degradable;
- una función no está terminada hasta quedar especificada, probada, documentada
  y distribuida correctamente.

## Estado de `main`

`main` contiene la evolución a **v0.6.0**: instancia única y CLI, edición
Markdown/Wikitext por documento, preview MediaWiki saneada, fluidez editorial,
recuperación, pestañas entre ventanas, diagnóstico, migraciones y reducción de
la superficie de permisos. La rama local `alexei` ya fue integrada y retirada.

Comprobaciones realizadas:

- [x] ocho suites JavaScript;
- [x] pruebas Rust aisladas del parser de argumentos;
- [x] contrato de empaquetado;
- [x] validación Allium sin errores nuevos;
- [x] `cargo fmt --check`;
- [ ] `cargo check` y build nativo completo en una máquina con encabezados de
  GTK/WebKit instalados;
- [ ] pruebas manuales de instancia única, menú, asociaciones e instaladores en
  macOS, Windows y Linux;
- [x] integración local en `main`;
- [ ] push de `main`, etiqueta `v0.6.0` y release.

Nada de lo marcado como pendiente debe declararse listo sólo porque la interfaz
web funcione fuera de Tauri.

## Hito 1 — cerrar y publicar v0.5.0

### Verificación nativa

- [ ] Abrir varios archivos desde el sistema crea pestañas en una sola ventana.
- [ ] Reabrir una ruta activa su pestaña y no duplica el documento.
- [ ] Una segunda invocación restaura, enfoca y entrega archivos a Luca.
- [ ] `luca archivo…`, `--new`, `--help` y `--version` funcionan desde consola.
- [ ] Reordenar pestañas por arrastre o teclado conserva texto, estado sucio,
  selección, historial, cursor y scroll.
- [ ] Los enlaces `http` y `https` salen al navegador predeterminado; Luca nunca
  reemplaza su interfaz por una página web.
- [ ] La edición por bloques funciona en vista mixta y renderizada.
- [ ] El icono oficial aparece en aplicación, ventana, menú, dock, asociaciones e
  instaladores.
- [ ] “Acerca de Luca” muestra versión, autoría, MediaFranca, Pacioli, Casiopea,
  repositorio y licencia.
- [ ] `.dmg`, instalador de Windows, `.deb`, `.rpm` y AppImage contienen
  metadatos, iconos y asociaciones correctos.

### Documentación pública en GitHub

El README presenta el producto; una guía de uso separada debe explicar las
funciones sin obligar a descubrirlas por accidente.

- [x] Crear `docs/uso.md` y enlazarlo prominentemente desde el README.
- [x] Documentar todos los atajos de archivo: nuevo, abrir, guardar, guardar como,
  cerrar pestaña, exportar PDF y preferencias.
- [x] Documentar los tres modos, el modo zen y la edición por bloques en vista
  mixta y renderizada.
- [x] Documentar la **multiselección**: `⌘D` / `Ctrl+D`, selección de la siguiente
  aparición y operaciones simultáneas sobre los cursores.
- [x] Documentar reordenamiento de pestañas por arrastre y con
  `Alt+Shift+←/→`.
- [x] Documentar instancia única, deduplicación por ruta y apertura de varios
  archivos desde sistema y CLI.
- [x] Documentar la barra completa: encabezados H1–H6 y párrafo, negrita,
  cursiva, tachado, subrayado, superíndice, subíndice, código, cita, listas,
  tareas, bloque de código, enlace Markdown, enlace interno y tablas.
- [x] Documentar el editor visual de tablas, alineación, cambio de eje, filas y
  columnas, y pegado/copiado tabular cuando corresponda al comportamiento real.
- [x] Documentar Mermaid offline, motores incluidos, errores visibles y qué
  sintaxis no interpreta Luca.
- [x] Documentar rutas relativas de imágenes y medios, sincronización de scroll,
  cambios externos, guardado atómico y confirmación antes de descartar.
- [x] Documentar claro/oscuro, tipografías, tokens de diseño, importación,
  exportación y restauración de valores.
- [x] Documentar diferencias entre paquete instalable y AppImage portátil,
  incluida la integración del icono y asociaciones en Linux.
- [x] Añadir capturas actuales y texto alternativo útil.
- [ ] Mantener una sección de cambios por release y enlazar las funciones a sus
  issues o specs cuando ayude a verificarlas.

## Hito 2 — formatos por documento: Markdown y Wikitext

### Modelo de interacción

El formato pertenece a cada documento, no a toda la aplicación.

- [x] Añadir una barra de estado compacta al pie del editor.
- [x] Mostrar a la derecha el formato supuesto: **Markdown** o **Wikitext**.
- [x] Al pulsarlo, desplegar:
  - Automático por extensión;
  - Markdown;
  - Wikitext.
- [x] Inferir `.md` y `.markdown` como Markdown.
- [x] Inferir `.wiki` y `.wikitext` como Wikitext.
- [x] Usar la preferencia global sólo como formato inicial de documentos nuevos.
- [x] Permitir Markdown y Wikitext simultáneamente en pestañas distintas.
- [x] Guardar el override por ruta en el estado local de Luca, nunca dentro del
  archivo.
- [x] En documentos sin ruta, mantener el override en la pestaña y asociarlo al
  guardar.
- [x] En modo automático, volver a inferir tras un cambio de extensión; con
  override, conservar la elección explícita.
- [x] Avisar discretamente cuando formato y extensión discrepen, sin impedir el
  guardado.
- [x] Cambiar el formato sólo altera interpretación, resaltado, comandos y vista
  previa: **no convierte ni reescribe el contenido**.

### Primer corte: edición fuente Wikitext

- [x] Especificar inferencia, override, persistencia y preservación byte-fiel en
  Allium antes de implementar.
- [x] Reutilizar o adaptar una gramática mantenida para CodeMirror 6; evaluar
  primero el trabajo oficial de MediaWiki y su compatibilidad/licencia.
- [x] Resaltar títulos, énfasis, listas, enlaces internos y externos, plantillas,
  parámetros, comentarios, tablas, etiquetas y referencias.
- [x] Ajustar la barra de herramientas al formato activo: no insertar sintaxis
  Markdown en un documento Wikitext.
- [x] Añadir asociaciones de archivo, filtros de apertura/guardado, MIME e iconos
  para `.wiki` y `.wikitext` en todos los instaladores.
- [x] Añadir fixtures reales y pruebas que demuestren que abrir y guardar Wikitext
  no altera bytes, saltos de línea ni sintaxis desconocida.
- [x] Actualizar README, guía de uso, ayuda, Acerca de y metadatos: Luca dejará de
  describirse como exclusivamente Markdown.

Referencia primaria: [CodeMirror de MediaWiki](https://www.mediawiki.org/wiki/Extension:CodeMirror).

### Segundo corte: vista previa mediante una wiki

Wikitext no tiene una previsualización universal: plantillas, funciones,
extensiones, espacios de nombres y estilos pertenecen a una instalación
MediaWiki. Luca no construirá un parser aproximado que finja equivalencia.

- [x] Permitir configurar una wiki de previsualización; Casiopea será la primera.
- [x] Enviar texto y contexto de título a la API oficial `action=parse`.
- [x] Sanear estrictamente el HTML antes de insertarlo en el WebView.
- [x] Resolver recursos y enlaces respecto de la wiki configurada.
- [x] Abrir enlaces web en el navegador; definir explícitamente el comportamiento
  de enlaces internos de la wiki.
- [x] Mostrar estado inequívoco: wiki usada, actualizando, sin conexión, respuesta
  en caché o error.
- [x] Mantener edición fuente completa sin conexión.
- [x] No presentar una respuesta en caché como si fuera actual.
- [x] Definir límites, cancelación y debounce para no enviar el documento en cada
  pulsación.
- [x] Tratar autenticación y cookies como una capacidad posterior y explícita;
  no reutilizar sesiones del navegador silenciosamente.

Referencia primaria: [API de parsing de Wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext).

### Fuera de este hito

Un WYSIWYG Wikitext reversible y sin pérdida no es “otro renderer”. MediaWiki lo
resuelve mediante Parsoid y VisualEditor. Sólo se evaluará después de validar la
edición fuente y la previsualización remota; no se implementará un subconjunto
ambiguo bajo la etiqueta WYSIWYG.

Referencia primaria: [Parsoid](https://www.mediawiki.org/wiki/Parsoid).

## Hito 3 — fluidez editorial

- [x] Ayuda de atajos consultable desde la aplicación.
- [x] Paleta de comandos con búsqueda por nombre y atajo.
- [x] Buscar y reemplazar, seleccionar todas las apariciones e ir a línea.
- [x] Esquema lateral de encabezados para navegar documentos largos.
- [x] Barra de estado sobria: línea, columna, codificación, fin de línea y formato.
- [x] Archivos recientes y restauración de pestañas entre sesiones.
- [x] Recuperación de borradores tras cierre inesperado, sin sustituir archivos.
- [x] Indicadores claros de guardado, cambio externo y conflicto.
- [x] Mejorar el resaltado semántico de Markdown y Wikitext con contraste
  comprobado, sin convertir el editor en un arcoíris de IDE.
- [x] Añadir semántica de pestañas, regiones y diálogos, navegación de pestañas
  por teclado, foco visible y retorno del foco; cubrirlo con regresión automática.
- [ ] Probar manualmente la navegación completa por teclado, lector de pantalla,
  zoom y movimiento reducido en la aplicación nativa.

## Hito 4 — pestañas entre ventanas

La ventana única sigue siendo el comportamiento normal; nuevas ventanas son una
acción explícita.

- [x] `⌘⇧N` / `Ctrl+Shift+N`: nueva ventana.
- [x] Arrastrar una pestaña fuera crea una ventana.
- [x] Arrastrar sobre otra ventana reúne la pestaña.
- [x] Menú **Ventana → Reunir todas las ventanas**.
- [x] Mover pestañas entre ventanas también mediante teclado y menú.
- [x] Mantener un registro global con un único dueño por documento.
- [x] Transferir sin pérdida texto sin guardar, historial de deshacer, selección,
  cursores múltiples, scroll, formato supuesto/override y modo de vista.
- [x] Resolver qué ocurre al cerrar una ventana con documentos sucios.
- [x] No iniciar implementación hasta especificar propiedad, transferencia y
  recuperación ante fallo.

## Hito 5 — confianza y v1.0

- [ ] Matriz automatizada y manual en macOS Apple Silicon/Intel, Windows y Linux.
- [ ] Instaladores firmados/notarizados y actualizaciones verificables.
- [x] Política de migración para preferencias y estado local.
- [x] Prueba estructural de accesibilidad y revisión visual base en navegador.
- [ ] Pruebas de accesibilidad con tecnología de asistencia y regresión visual
  esenciales en la aplicación nativa de cada plataforma.
- [x] Diagnóstico exportable sin incluir documentos, credenciales ni rutas
  sensibles.
- [x] Política de privacidad y conectividad que distinga recursos locales,
  actualización, CDN y previsualización MediaWiki.
- [x] Documentación de recuperación, desinstalación y ubicación de datos.

## Optimización, seguridad y limpieza

### El WebView no es el navegador accidental

Luca usa Tauri: CodeMirror, la vista previa y toda la interfaz HTML/CSS/JS corren
en el **WebView del sistema**. Quitar ese motor equivaldría a reescribir la
aplicación con una interfaz nativa y perder el fundamento técnico actual. Lo que
sí debe eliminarse es el comportamiento de navegador:

- [x] los enlaces web se delegan al navegador predeterminado;
- [x] bloquear también a nivel nativo cualquier navegación no autorizada de la
  ventana principal, aunque un manejador de la interfaz falle;
- [x] auditar todos los lugares que producen enlaces: preview, Acerca de,
  Mermaid y futura vista Wikitext;
- [x] conservar anclas internas sólo cuando pertenecen al documento actual;
- [x] añadir pruebas que demuestren que ninguna URL sustituye la interfaz.

### Carga y tamaño

El runtime web actual ocupa aproximadamente 15 MiB; Mermaid, ELK y ZenUML
concentran la mayor parte.

- [ ] Medir tamaño instalado, tiempo de arranque, memoria con 1/10/50 pestañas y
  latencia de escritura antes de optimizar.
- [x] Cargar Marked y Mermaid sólo cuando la vista previa se usa.
- [x] Cargar Mermaid y cada motor de layout sólo cuando el documento contiene un
  diagrama que lo necesita.
- [x] Evaluar si ELK, tidy-tree y ZenUML deben distribuirse siempre o como módulos
  opcionales; preservar Mermaid offline como contrato.
- [ ] Evitar rerenderizar el documento completo cuando una actualización por
  bloques sea correcta y mediblemente mejor.
- [x] Cancelar renders obsoletos en vez de dejarlos terminar.
- [ ] Medir antes de virtualizar editores o previews inactivos; no sacrificar
  historial, cursor ni scroll por ahorrar memoria teórica.
- [x] Comprimir/optimizar el icono que se copia al runtime sin crear otra fuente
  maestra.

### Offline, red y superficie de permisos

- [x] Eliminar el respaldo CDN si los recursos vendor locales cubren todas las
  rutas; entonces retirar `cdn.jsdelivr.net` de CSP y `connect-src`.
- [x] Si se conserva un fallback de red, hacerlo explícito en Preferencias y en la
  documentación, desactivado por defecto. No se conserva ningún fallback.
- [x] Restringir `assetProtocol.scope`, actualmente `**`, a las rutas mínimas que
  necesitan los documentos abiertos.
- [x] Reducir permisos de opener a protocolos y destinos necesarios.
- [x] Revisar `dangerousDisableAssetCspModification` y `unsafe-inline`; retirar
  excepciones que ya no sean necesarias.
- [x] Sanear HTML Markdown y Wikitext sin romper contenido legítimo ni permitir
  que un archivo local ejecute interfaz o scripts privilegiados.
- [x] Separar en la UI y la política de red: actualizaciones, recursos opcionales
  y previsualización mediante MediaWiki.

### Reproducibilidad y repositorio

- [x] Versionar `package-lock.json` y usar `npm ci` en CI para builds
  reproducibles.
- [x] Auditar dependencias npm y Cargo por uso real, licencia, tamaño y
  mantenimiento antes de añadir nuevas.
- [x] Confirmar que el antiguo árbol Swift `.build/` no es fuente ni artefacto de
  distribución; después retirarlo del repositorio en un cambio explícito y
  recuperable, nunca como limpieza lateral.
- [x] Mantener `ui/vendor/`, `node_modules/` y `src-tauri/target/` como generados.
- [ ] Hacer que CI verifique versiones sincronizadas, contenido de paquetes,
  asociaciones, iconos, specs, pruebas y build de cada plataforma antes de una
  release.
- [x] Publicar tamaños y hashes de artefactos para detectar regresiones en cada
  release; la primera publicación efectiva ocurrirá con `v0.6.0`.

## Criterio de terminado para cualquier hito

Un cambio está terminado cuando:

1. su comportamiento observable está en Allium;
2. la implementación preserva archivos y cambios ajenos;
3. las pruebas focalizadas y de regresión pasan;
4. se comprobó en la aplicación nativa, no sólo en navegador;
5. la función es encontrable, accesible y está documentada en GitHub;
6. los instaladores y metadatos de cada plataforma son coherentes;
7. quedan registrados límites, riesgos y verificaciones no ejecutadas;
8. el commit es acotado y la publicación ocurre sólo con autorización explícita.
