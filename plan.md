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

### 1. Atajos de abrir y guardar retirados del manejador global

En `ui/app.js`, el manejador global de `keydown` anuncia y maneja varios
comandos, pero no contiene ramas para `Cmd/Ctrl+O`, `Cmd/Ctrl+S` ni
`Cmd/Ctrl+Shift+S`. El código delega esos casos al menú nativo. En los WebViews
probados esa suposición no funcionó de manera fiable. Esto explica directamente
que `Cmd/Ctrl+O` no haga nada.

No se ha aplicado todavía un arreglo. El siguiente agente debe centralizar la
ejecución de comandos para que menú, paleta y teclado invoquen la misma ruta, y
probarla dentro de Tauri en macOS y Linux.

### 2. Barra de herramientas desaparecida o inutilizable

La barra se crea dinámicamente junto a los modos mediante
`createEditorToolbar`. Comparada con `v0.4.2`, se agregaron en la misma fila los
selectores de archivos recientes y esquema, además de los controles ya
existentes. La fila está sometida a mucha más presión horizontal y la propia
barra puede encogerse y desbordarse. Herbert informa que en las aplicaciones
nativas desaparece por completo.

La prueba del frontend servido por HTTP en Chrome sí montó CodeMirror y la
barra, por lo que esa prueba no reproduce ni descarta el fallo del WebView
nativo. Aún falta capturar consola y geometría dentro de Tauri.

### 3. El editor no acepta escritura

Está confirmado por Herbert en macOS y Linux. La causa todavía **no está
aislada**. No atribuirla sin evidencia al caché de `ui/vendor/`: esa fue una
hipótesis inicial, pero el fallo se reprodujo también en Linux y el bundle
local inspeccionado sí contiene las APIs nuevas de CodeMirror (`setFormat`,
`gotoLine`, `selectAllMatches` y `getCursorLocation`).

Posibles áreas de investigación, no conclusiones:

- error o excepción del WebView nativo que no aparece en la prueba HTTP;
- foco capturado por controles o diálogos superpuestos;
- interacción entre restauración de sesión, activación del documento y
  serialización de CodeMirror;
- diferencias del protocolo Tauri, CSP o APIs globales respecto del navegador;
- geometría, `z-index` o `pointer-events` de la nueva interfaz.

El próximo diagnóstico debe comenzar obteniendo la consola del WebView y una
traza de eventos de foco/teclado en una ejecución nativa, no agregando parches a
ciegas.

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
