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

MVP **multiplataforma** sobre [Tauri 2](https://tauri.app): el frontend es web
(`ui/`, Markdown con `marked` + diagramas con `mermaid`), envuelto en una cáscara
nativa ligera. Una sola base de código sirve para macOS, Windows, Linux y —vía
Tauri 2— móvil. El editor es un `<textarea>` con preview en vivo.

- `marked` y `mermaid` se cargan desde CDN → requiere red. Vendorizar los dos
  `.js` en `ui/` cuando importe el modo offline.

## Estructura

- `ui/` — frontend (HTML/CSS/JS, sin bundler).
- `src-tauri/` — cáscara nativa (Rust + Tauri).
- `icon.svg` — fuente del icono; regenerar el set con `cargo tauri icon icon.png`.

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
