# luca

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
swift run
```

Panel izquierdo: editor. Panel derecho: preview en vivo con **diagramas Mermaid**.

## Estado

MVP ejecutable en **AppKit puro** (`NSTextView` + `WKWebView`) — compila con las
Command Line Tools, sin necesidad de Xcode. Una ventana, editor + preview.

Todavía **no** es una app de documentos (abrir/guardar `.md`, recientes, ventana
por archivo); eso pide migrar a un proyecto Xcode con `NSDocument`.

- `marked` y `mermaid` se cargan desde CDN → requiere red. Vendorizar los dos
  `.js` al bundle cuando importe el modo offline.

## Próximos pasos

1. Abrir/guardar archivos (`NSOpenPanel`/`NSSavePanel`, o migrar a document-based).
2. Vendorizar marked + mermaid (offline, carga instantánea).
3. Debounce del render y scroll sincronizado.
