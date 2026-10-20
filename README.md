# luca

**luca** es el editor Markdown de [Vera](https://github.com/mediafranca), parte
del ecosistema **Media Franca** (`mediafranca/luca`). Un editor sencillo y
rápido para elaborar el texto de una página antes de publicarla en Vera, con
vista previa en vivo y diagramas Mermaid.

Luca toma su nombre de Luca Pacioli, fraile franciscano y matemático del
Renacimiento italiano. En [*Divina proportione*](https://es.wikipedia.org/wiki/La_divina_proporci%C3%B3n),
publicado en 1509, Pacioli incluyó un estudio sobre la construcción geométrica
de las letras capitales: una manera de entender la escritura desde su forma, sus
proporciones y el cuidado de sus trazos.

El nombre recoge esa atención a la forma escrita y la lleva a una herramienta
cotidiana. Luca nace como un editor Markdown sencillo y rápido, pensado para que
escribir, revisar y organizar un texto requiera el mínimo de intermediaciones.
La referencia a Pacioli expresa una intención de diseño: ofrecer un entorno
claro y proporcionado, cuya forma acompañe el trabajo de quien escribe.

Dentro del ecosistema Media Franca, Luca se concibe como un lugar de elaboración
del texto, pensado para facilitar su posterior publicación en Vera. Markdown
ofrece una base legible y portable para ese recorrido, manteniendo el texto
disponible para otras herramientas.

Luca es también un nombre breve y fácil de recordar. Su historia puede
descubrirse después; para comenzar, basta abrirlo y escribir.

> Referencia: Luca Pacioli y la construcción de letras en *Divina proportione* —
> Politecnico di Milano.

## Correr

```bash
cargo tauri dev
```

Panel izquierdo: editor. Panel derecho: preview en vivo con **diagramas Mermaid**.

Para empaquetar la app nativa del sistema actual:

```bash
cargo tauri build
```

## Estado

App **multiplataforma** sobre [Tauri 2](https://tauri.app): una sola base de
código para macOS, Windows, Linux y —vía Tauri 2— móvil.

- Editor **CodeMirror 6** con resaltado de Markdown; **multidocumento** por
  pestañas (una apertura nueva no cierra las demás).
- Vista previa en vivo: `marked` + **Mermaid 12 offline** con los motores ELK,
  tidy-tree y ZenUML (CDN sólo de respaldo).
- Abrir/guardar `.md` nativo, guardado atómico y aviso ante cambios externos.

## Estructura

- `ui/` — frontend (HTML/CSS/JS; CodeMirror empaquetado con esbuild).
- `src-tauri/` — cáscara nativa (Rust + Tauri).
- `specs/` — especificación [Allium](https://github.com/mediafranca) del
  comportamiento (ver abajo).
- `scripts/vendor.mjs` — vendoriza mermaid/marked y empaqueta CodeMirror a
  `ui/vendor/` (`npm run vendor`, también en `beforeDevCommand`).
- `icon.svg` — fuente del icono; regenerar el set con `cargo tauri icon icon.png`.

## Especificación (Allium)

El comportamiento de luca está descrito en `specs/*.allium`, por consistencia
con los demás repos de Media Franca:

- `luca.allium` — módulo raíz (vocabulario y configuración).
- `documento.allium` — modelo de documento y ciclo de vida multidocumento.
- `vista-previa.allium` — superficies de editor y vista previa.
- `vera.allium` — contrato de lanzamiento e integración con Vera.

Validar con `allium check specs/`.

## Integración con Vera

Luca es un editor de texto honesto y sin estado de Vera. El Markdown se guarda
tal cual se escribe —sin IDs ni normalización—; Vera lleva las identidades en su
manifiesto lateral. Luca se declara editor de `.md` / `text/markdown`
(`bundle.fileAssociations`), así que Vera lo descubre por "Abrir con…" sin rutas
escritas a mano. Un protocolo mayor (CLI / deep-link) se añadirá solo cuando haya
una necesidad concreta.

## Próximos pasos

1. Editor real con CodeMirror (resaltado de sintaxis, también para Mermaid).
2. Packs de iconos de Mermaid (iconify-json: logos, fa, material-icon-theme).
3. Protocolo de vinculación con Vera cuando se defina (single-instance / deep-link).
