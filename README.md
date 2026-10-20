<div align="center">

<img src="icon.png" width="140" alt="Luca">

# Luca

**El editor Markdown para [Vera](https://github.com/mediafranca)**
</div>

Luca es un editor Markdown sencillo y rápido con soporte para diagramas Mermaid.

Luca toma su nombre de Luca Pacioli, fraile franciscano y matemático del
Renacimiento italiano. En [*Divina proportione*](https://archive.org/download/divinaproportion00paci/divinaproportion00paci.pdf),
publicado en 1509, Pacioli incluyó un estudio sobre la construcción geométrica
de las letras capitales: una manera de entender la escritura desde su forma, sus
proporciones y el cuidado de sus trazos.

El nombre recoge esa atención a la forma escrita y la lleva a una herramienta
cotidiana. Luca nace como un editor Markdown sencillo y rápido, pensado para que
escribir, revisar y organizar un texto requiera el mínimo de intermediaciones.
La referencia a Pacioli expresa una intención de diseño: ofrecer un entorno
claro y proporcionado, cuya forma acompañe el trabajo de quien escribe.

Dentro del ecosistema MediaFranca, Luca se concibe como un lugar de elaboración
del texto, pensado para facilitar su posterior publicación en Vera. Markdown
ofrece una base legible y portable para ese recorrido, manteniendo el texto
disponible para otras herramientas.

> *Divina proportione* (Pacioli, 1509):
> [facsímil original](https://archive.org/download/divinaproportion00paci/divinaproportion00paci.pdf) ·
> [edición en español](https://matematicasiesoja.wordpress.com/wp-content/uploads/2020/04/la-divina-proporcic3b3n.-pdfdrive.com-.pdf)

## Funcionalidades actuales

- Editor **CodeMirror 6** con resaltado de sintaxis Markdown.
- **Multidocumento** por pestañas: abrir un archivo no cierra los demás, y
  reabrir uno ya abierto reutiliza su pestaña.
- Modos de vista **source · split · rendered** y **modo zen** que oculta las
  barras (atajos `⌘1`/`⌘2`/`⌘3`, `⌘⇧Z`, y `Esc` para salir del zen).
- Vista previa en vivo: `marked` + **Mermaid 12 offline** con los motores
  ELK, tidy-tree y ZenUML (CDN sólo de respaldo).
- Abrir/guardar `.md` nativo, **guardado atómico** y aviso ante cambios
  externos (no pisa en silencio lo que tocó otra app).
- Asociación de tipo `.md` / `text/markdown`: el sistema (y Vera) abren Luca
  por "Abrir con…".
- Tipografía y tokens de color de **Vera** (IBM Plex), con claro/oscuro.
- **Multiplataforma** sobre [Tauri 2](https://tauri.app): macOS, Windows,
  Linux y —vía Tauri 2— móvil, desde una sola base de código.

## Capturas

![Captura de pantalla de Luca](./assets/luca-screenshot.png)

## Correr

```bash
cargo tauri dev
```

Para empaquetar la app nativa del sistema actual:

```bash
cargo tauri build
```

## Estructura

- `ui/` — frontend (HTML/CSS/JS; CodeMirror empaquetado con esbuild).
- `src-tauri/` — cáscara nativa (Rust + Tauri).
- `specs/` — especificación [Allium](https://github.com/mediafranca) del
  comportamiento (ver abajo).
- `scripts/vendor.mjs` — vendoriza mermaid/marked y empaqueta CodeMirror a
  `ui/vendor/` (`npm run vendor`, también en `beforeDevCommand`).
- `icon.png` — fuente del icono (la «L» construida al modo de Pacioli);
  regenerar el set con `cargo tauri icon icon.png`.

## Especificación (Allium)

El comportamiento de Luca está descrito en `specs/*.allium`, por consistencia
con los demás repos de MediaFranca:

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

1. Editar en modo *rendered* (WYSIWYG) — lo realmente «zen» del editor.
2. Resolver rutas relativas de assets en la vista previa.
3. Resaltado de sintaxis de Mermaid dentro del fence (gramática Lezer).
4. Packs de iconos de Mermaid (iconify-json).

## Contribuir

Las contribuciones son bienvenidas: ver [CONTRIBUTING.md](CONTRIBUTING.md).

<div align="center">
<img src="assets/raised-fist.svg" width="70" alt="Puño alzado"><br>Aplicación soberana
<br><sub>Puño alzado: Eugenio Hansen, OFS — trabajo propio,
<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, vía
<a href="https://commons.wikimedia.org/w/index.php?curid=65787095">Wikimedia Commons</a>.</sub>
</div>

## Autoría y licencia

Luca es obra de [Herbert Spencer González](https://github.com/hspencer), dentro
de MediaFranca. Publicado bajo la [Licencia Pública de la Unión Europea
(EUPL 1.2)](LICENSE).
