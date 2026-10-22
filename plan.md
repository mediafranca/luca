# Informe de rescate de Luca

> Estado al 22 de octubre de 2026. Este documento reemplaza el plan anterior y
> deja un relevo verificable para continuar el trabajo con otro agente.

## Alerta principal

La versión `v0.6.0` **no es utilizable y no debe volver a publicarse** sin una
prueba manual completa en una aplicación Tauri nativa.

Herbert comprobó la misma regresión en dos equipos y sistemas distintos:

- Andrei, macOS: la aplicación compilada después de `git pull` no abre archivos
  Markdown con `Cmd+O`, perdió la barra de herramientas, no responde de forma
  general y no permite escribir en el editor.
- Alexei, Debian Linux: presenta el mismo retroceso; tampoco permite escribir.

El release público `v0.6.0` fue eliminado de GitHub para impedir nuevas
descargas. El tag Git `v0.6.0` todavía existe y apunta a `33c3d34`; no se movió
ni se borró para evitar reescribir historia sin una decisión explícita.

No considerar terminado el plan anterior. No eliminar este archivo hasta que
la aplicación nativa haya sido recuperada y certificada manualmente.

## Qué ocurrió

Se amplió Luca desde la base `v0.4.2` con funciones editoriales, Wikitext,
sesiones, accesibilidad, varias ventanas, seguridad, documentación y un flujo
de release multiplataforma. Las pruebas JavaScript, las pruebas aisladas de
Rust, `cargo check` en CI y la creación de paquetes pasaron, pero esas
comprobaciones no abrieron ni ejercitaron la interfaz Tauri real.

Ese vacío fue crítico: se publicó `v0.6.0` después de ver verde la matriz de
GitHub Actions para Linux, macOS y Windows, sin haber completado la prueba
manual nativa que el propio plan exigía. Compilar, empaquetar y comprobar
archivos no demostró que el editor aceptara teclado, que los comandos abrieran
diálogos ni que la barra siguiera siendo operable.

La publicación fue, por tanto, prematura. No debe tomarse el verde de CI como
evidencia de funcionamiento de la aplicación.

## Regresiones confirmadas

### 1. Atajos de abrir y guardar: observación inicial, no causa raíz

En `ui/app.js`, el manejador global de `keydown` no contiene ramas para
`Cmd/Ctrl+O`, `Cmd/Ctrl+S` ni `Cmd/Ctrl+Shift+S`; esos aceleradores se delegan
al menú nativo. Esta arquitectura ya existía en `v0.4.2`, por lo que no explica
por sí sola el retroceso. En la compilación rota ningún atajo podía funcionar
porque `app.js` no llegaba a ejecutarse.

Sigue siendo recomendable centralizar menú, paleta y teclado en una misma ruta,
pero no debe presentarse esta observación como causa confirmada del incidente.

### 2. Causa raíz confirmada: runtime `vendor` obsoleto

`ui/vendor/` no se versiona. `scripts/vendor.mjs` salía inmediatamente si esa
carpeta ya existía, aunque perteneciera a una revisión anterior. Después de un
`git pull`, Tauri ejecutaba el hook `npm run vendor`, pero el hook no actualizaba
nada.

En el checkout principal de Alexei se confirmó que faltaba
`ui/vendor/dompurify/purify.es.mjs`, importado estáticamente al comienzo de
`ui/app.js`, y que el bundle de CodeMirror era anterior. Al fallar ese import,
el módulo completo no se ejecutaba: no se insertaba la barra, no se creaba el
editor y no se registraban eventos. Esto explica conjuntamente los síntomas
observados en macOS y Linux.

Se corrigió `scripts/vendor.mjs` para reconstruir siempre la carpeta completa.
El arreglo debe verificarse todavía en una ejecución Tauri nativa en macOS y
Linux antes de declarar recuperada la aplicación.

### 3. Segunda causa raíz confirmada: la CSP bloqueaba los estilos de CodeMirror

Verificado el 21 de octubre de 2026 en Tauri nativo (Debian, WebKitGTK 2.54)
con el inspector remoto del WebView: incluso con `ui/vendor/` correcto, el
documento tenía una sola hoja de estilos. CodeMirror inyecta su tema base en un
`<style>` dinámico y `f0830b0` quitó `dangerousDisableAssetCspModification:
["style-src"]` de `tauri.conf.json` (lo había añadido `dbd6985` justamente para
esto). Tauri pasó a añadir hashes a `style-src`; por la especificación de CSP,
con hashes presentes `'unsafe-inline'` se ignora y el `<style>` de CodeMirror
(y los `<style>` dentro del SVG de Mermaid) quedaron bloqueados. Sin el tema
base, `.cm-scroller` no es `flex`: la numeración ocupa todo el ancho y el
contenido queda apilado 2000 px más abajo, fuera de la ventana y sin scroll.
Aplica a todas las plataformas. Corregido restaurando la clave y con un guard
en `scripts/check-packaging.mjs`.

### 4. Las confirmaciones nunca bloqueaban

En la webview de Tauri el plugin de diálogos sustituye `window.confirm` por
una función asíncrona que devuelve una `Promise`. `app.js` la usaba como
booleano síncrono (`!confirm(...)`), así que «¿Sobrescribir?» y «¿Cerrar
igual?» se mostraban después de haber sobrescrito el archivo o cerrado la
pestaña. Verificado en nativo: con el archivo modificado fuera, Guardar lo
pisaba antes de responder. Corregido con `await` en ambos puntos.

### 5. El editor no aceptaba escritura

Es una consecuencia del mismo fallo de carga: sin ejecutar `app.js`, CodeMirror
nunca se montaba. Si el problema persiste después de reconstruir `ui/vendor/`,
el siguiente diagnóstico debe obtener la consola del WebView y una traza de
foco/teclado en una ejecución nativa, no agregar parches a ciegas.

## Sesión de auditoría del 21 de octubre de 2026

Verificado en Tauri nativo (Linux, binario compilado desde `dev`) con un
archivo CRLF de prueba: arranque con ruta por argumento, teclado en el editor,
vista dividida con Mermaid, guardado byte-fiel (CRLF conservado), instancia
única (misma ruta no se duplica, segunda ruta se añade), diálogo de
modificación externa y diálogo de cierre con cambios. Correcciones en `dev`:

- CSP: `dangerousDisableAssetCspModification: ["style-src"]` restaurado y
  `media-src` añadido para vídeo y audio locales.
- `confirm()` con `await` al sobrescribir y al cerrar pestañas con cambios.
- Guardado y sesión con `getSource()` (`sliceDoc`): `toString()` de CodeMirror
  convertía CRLF/CR a LF al guardar.
- Permiso `core:window:allow-close`, necesario para mover o reunir pestañas.
- Fences de código y Mermaid escapados antes de DOMPurify (`<br/>`, `|x<5|`).
- Barra de herramientas y editor de tablas condicionados al formato
  (`ui/format-syntax.js`, `ui/wikitext-table.js`); en Wikitext ya no se
  ocultan. 11 tests nuevos.
- Barra superior: «Recientes» pasó al submenú nativo «Archivo ▸ Abrir
  reciente» (`set_recent_files`) y «Esquema» a un panel lateral opcional con
  botón, para que la barra quepa en 960 px.
- `node_modules` debe reinstalarse (`npm ci`): `@bhsd/codemirror-wikitext`
  faltaba y `npm run vendor` abortaba sin generar `editor.js`.

Pendiente y documentado en el informe de la sesión: desborde de la barra a
960 px (selectores Recientes y Esquema), Mermaid `securityLevel: "loose"`,
borrador restaurado que no recuerda el mtime original, cierre de ventana sin
confirmación, temporal huérfano si falla el `rename`.

## Trabajo incorporado desde `v0.4.2`

Historial actual, de más reciente a más antiguo:

- `c75f2c5` — agregó Flatpak como hito comunitario al roadmap.
- `33c3d34` — documentó la auditoría de dependencias; es el objetivo del tag
  `v0.6.0`.
- `71129a9` — corrigió la compilación del guard de navegación con la versión
  actual de Tauri.
- `1b3894d` — agregó tamaños y SHA-256 de instaladores al flujo de release.
- `ede286d` — agregó pruebas de round-trip byte-fiel para Wikitext.
- `296dc4e` — agregó mejoras de accesibilidad por teclado.
- `ba38f74` — alineó documentación para la versión 0.6.
- `6ce0f2f` — sincronizó versiones y preparó `0.6.0`.
- `f0830b0` — completó trabajo de multiventana, seguridad y confianza.
- `4a684d9` — eliminó artefactos Swift obsoletos.
- `0ef599e` — restauró controles de multiventana y confianza.
- `71f1485` — agregó Wikitext y flujo editorial.
- `1ce36e5` — agregó el plan de evolución original.
- `3dc4732` — evolucionó Luca a un espacio único con pestañas.
- `a1aec9d` — abrió enlaces fuera de Luca y habilitó edición en vista mixta.

### Funcionalidad añadida o modificada

- Formatos Markdown y Wikitext por documento, detección por extensión y
  preservación del texto original.
- Previsualización Wikitext a través de una API MediaWiki HTTPS configurada.
- Restauración de sesión, archivos recientes, esquema de encabezados, estado de
  cursor, codificación y fin de línea.
- Paleta de comandos y diálogo de atajos.
- Varias ventanas, transferencia de pestañas y prevención de abrir una misma
  ruta en dos ventanas.
- Sanitización de HTML con DOMPurify, restricción del protocolo de assets,
  apertura externa de enlaces y guard de navegación.
- Diagnóstico exportable sin contenido, rutas ni credenciales.
- Mejoras de roles, foco, etiquetas y navegación de pestañas.
- Asociaciones de archivos Markdown y Wikitext en los paquetes.

Todas estas capacidades deben considerarse provisionales hasta que pasen una
prueba funcional nativa; su presencia en el código no prueba su usabilidad.

## Verificaciones que sí se ejecutaron

- 10 pruebas JavaScript pasaron, incluidas pruebas de formato, sesión,
  navegación, transferencia de ventanas, accesibilidad estática y Wikitext.
- 3 pruebas aisladas de I/O Rust pasaron.
- `allium check specs/` pasó con advertencias ya documentadas.
- La matriz de GitHub Actions compiló y empaquetó exitosamente en Ubuntu,
  macOS universal y Windows.
- Se generaron `.deb`, `.rpm`, `.AppImage`, `.dmg`, `.app.tar.gz`, `.msi` y
  `.exe`, con manifiestos de tamaño y SHA-256.
- `cargo audit` no encontró vulnerabilidades conocidas; informó seis
  advertencias documentadas en `THIRD_PARTY.md`, incluidas dependencias sin
  mantenimiento, una advertencia de `glib` y `tokio 1.54.0` retirado.
- `npm audit --omit=dev` informó 11 avisos: 2 bajos y 9 altos.
- El frontend servido por HTTP se montó en Chrome headless y creó CodeMirror.

Estas verificaciones sólo demuestran sus alcances concretos. Ninguna sustituyó
una prueba de la aplicación de escritorio.

## Verificaciones que no se ejecutaron antes de publicar

- Escribir texto en el editor dentro de Tauri.
- Abrir con menú, botón, `Cmd/Ctrl+O`, asociación de archivo y línea de comandos.
- Guardar, Guardar como, detectar modificaciones externas y cancelar cierres.
- Revisar visualmente la barra en los tamaños soportados.
- Probar pestañas, sesión restaurada, varias ventanas y transferencia.
- Probar Markdown, Wikitext, Mermaid, impresión y temas en paquetes instalados.
- Ejecutar tecnologías de asistencia.
- Instalar y probar manualmente cada artefacto de macOS, Linux y Windows.

## Estado de publicación y ramas

- `main` y `origin/main`: `c75f2c5` al redactar este informe.
- Rama de trabajo conservada: `codex/plan-cierre`, en el worktree
  `.worktrees/plan-cierre`.
- Tag conservado: `v0.6.0` → `33c3d34`.
- Release GitHub `v0.6.0`: eliminado el 22 de octubre de 2026 y confirmado como
  inexistente mediante `gh release view`.
- Workflow que produjo los binarios retirados: ejecución `39703572008`; sus tres
  jobs terminaron verdes, lo cual ilustra la insuficiencia del control actual.
- La rama antigua `alexei` fue eliminada previamente por petición de Herbert.

## Orden recomendado para el rescate

1. Marcar `v0.6.0` como fallida y decidir explícitamente si se conserva o elimina
   el tag. No moverlo silenciosamente.
2. Ejecutar Tauri nativo en modo desarrollo con consola del WebView visible.
3. Reducir el arranque hasta recuperar un editor capaz de recibir texto.
4. Comparar por bisección desde `v0.4.2`; no intentar reparar todas las funciones
   nuevas simultáneamente.
5. Recuperar la barra y validar su geometría a 960×620 y tamaños menores.
6. Unificar menú, teclado y paleta en un único despachador de comandos y cubrir
   abrir/guardar con pruebas.
7. Crear una prueba de humo nativa que compruebe al menos: documento inicial,
   entrada de teclado, abrir, guardar y presencia de la barra.
8. Reintroducir por grupos las capacidades nuevas, probándolas manualmente.
9. Publicar una versión SemVer nueva —no reutilizar binarios `v0.6.0`— sólo tras
   certificación humana en macOS, Linux y Windows.

## Flatpak: hito posterior al rescate

La publicación en Flathub sigue siendo un hito comunitario importante, pero no
debe comenzar hasta recuperar una versión estable.

La política de Flathub exige que el manifiesto y la interacción de la propuesta
no sean generados ni automatizados por IA. Herbert debe escribir personalmente
`net.mediafranca.luca.yml`, el texto del PR y las respuestas de revisión, además
de declarar el uso de IA en el proyecto upstream. La localización inglesa debe
ser humana. Un agente puede investigar, revisar y ejecutar validaciones sobre
material escrito por Herbert, pero no redactar el manifiesto ni la propuesta.

Referencias oficiales:

- <https://docs.flathub.org/docs/for-app-authors/requirements>
- <https://docs.flathub.org/docs/for-app-authors/metainfo-guidelines>
- <https://docs.flatpak.org/en/latest/sandbox-permissions.html>
- <https://v2.tauri.app/distribute/flatpak/>

## Criterio real para volver a declarar Luca lista

Luca sólo estará lista cuando una persona pueda instalar el artefacto final en
cada plataforma, escribir y editar texto, abrir y guardar Markdown, usar la
barra y los atajos, cerrar y reabrir documentos sin pérdida, y completar los
flujos esenciales sin errores de consola. CI debe complementar esa
certificación, no reemplazarla.
