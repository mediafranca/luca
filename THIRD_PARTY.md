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
