# Dependencias y licencias

Luca se distribuye bajo EUPL 1.2. Además incorpora dependencias de terceros con
sus propias licencias. Los avisos completos incluidos por cada paquete se
conservan en las distribuciones generadas desde `node_modules` y Cargo.

## Resaltado Wikitext

`@bhsd/codemirror-wikitext` adapta el modo de Wikitext de la extensión
CodeMirror de MediaWiki para uso independiente con CodeMirror 6. Ambos se
publican bajo **GPL-2.0-or-later**. Su código fuente y licencia se encuentran en:

- <https://github.com/bhsd-harry/codemirror-mediawiki/tree/wikitext>
- <https://github.com/wikimedia/mediawiki-extensions-CodeMirror>

Luca usa sólo la gramática local de resaltado; no activa las extensiones que
dependen de CDN, lint remoto o navegación web.

La evaluación de `0.12.1` mediante `npm audit --omit=dev` (21-10-2026) registra
avisos transitivos de severidad alta en `braces` dentro de las herramientas de
lint incluidas por el paquete. Esas herramientas no entran en `ui/`; la
construcción importa únicamente `mediawikiLanguage`. No hay corrección publicada
sin sustituir la dependencia, por lo que el aviso se revisará en cada versión.

## Mermaid y KaTeX

La misma auditoría registra un aviso bajo de contaminación de prototipo en
KaTeX, dependencia transitiva del adaptador ELK. La corrección sugerida por npm
degrada `@mermaid-js/layout-elk` a una versión incompatible y no se aplica
automáticamente. Luca configura Mermaid con contenido saneado, sin HTML activo,
y conserva el aviso hasta que la cadena compatible publique una actualización.

## Dependencias Rust y del sistema

La auditoría de `Cargo.lock` con `cargo-audit 0.22.2` (21-10-2026) no encuentra
vulnerabilidades conocidas. Registra seis advertencias transitivas:

- `proc-macro-error` está sin mantenimiento y llega mediante la familia GTK 3;
- `zbus_names`, `zvariant` y `zvariant_derive` están sin mantenimiento y llegan
  mediante `zbus`, usado por los plugins opener y single-instance;
- `glib 0.18.5`, parte de GTK/WebKit en Linux, tiene el aviso de solidez
  RUSTSEC-2024-0429;
- `tokio 1.54.0`, usado por Tauri y reqwest, fue retirado del índice (*yanked*).

No son dependencias directas reemplazables sin cambiar Tauri o sus plugins. La
matriz de CI compila contra el lockfile y esta auditoría debe repetirse en cada
release. Las dependencias directas de Rust usan licencias permisivas compatibles
(MIT, Apache-2.0 o ambas); `objc2`, usado sólo para impresión en macOS, es MIT.

La revisión de uso confirma que Tauri aporta el runtime y el protocolo local,
los tres plugins cubren diálogos, enlaces externos e instancia única, reqwest
realiza exclusivamente la preview MediaWiki HTTPS y serde/serde_json modelan
sus respuestas y el diagnóstico. La línea base de tamaños está en
[`docs/rendimiento.md`](docs/rendimiento.md).
