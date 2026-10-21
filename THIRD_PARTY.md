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

La evaluación de `0.12.1` registra avisos de auditoría transitivos en las
herramientas de lint incluidas por el paquete. Esas herramientas no entran en el
bundle de Luca; la construcción importa únicamente `mediawikiLanguage`. Se
mantienen registradas para revisar cada actualización de la dependencia.
