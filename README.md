<div align="center">

<img src="icon.png" width="120" alt="Luca">

# Luca

Editor Markdown de escritorio
</div>

Luca es un editor de texto Markdown para macOS, Windows y Linux. Guarda
archivos `.md` sin añadirles nada.

## Descargar

[Última versión](https://github.com/mediafranca/luca/releases/latest). En
**Assets**, elige el archivo de tu sistema:

| Sistema | Archivo |
| --- | --- |
| macOS | `Luca_x.y.z_universal.dmg` |
| Windows | `Luca_x.y.z_x64-setup.exe` |
| Linux | `.AppImage`, `.deb` o `.rpm` |

La app de macOS aún no está firmada. Si el sistema dice que no se puede abrir,
usa clic derecho y **Abrir**. Si el aviso persiste, en Terminal:

```bash
xattr -cr /Applications/Luca.app
```

## Qué hace

- Vista de código, vista dividida y vista renderizada (`⌘1`, `⌘2`, `⌘3`).
- En la vista renderizada se puede editar cada bloque en su lugar.
- Modo zen a pantalla completa (`⌘⇧Z`).
- Barra de formato y editor de tablas.
- Diagramas Mermaid, sin conexión.
- Varios documentos en pestañas. Guardado seguro y aviso si otro programa
  cambió el archivo.
- Exportar a PDF.
- Tipografía y colores configurables (`⌘,`), claro y oscuro.

![Luca](./assets/luca-screenshot.png)

## Desde el código

Requiere [Rust](https://rustup.rs), la CLI de Tauri 2 y [Node.js](https://nodejs.org).

```bash
npm install
cargo tauri dev
```

- `ui/`: interfaz (HTML, CSS y JavaScript; CodeMirror 6).
- `src-tauri/`: aplicación nativa (Rust, Tauri 2).
- `specs/`: especificación del comportamiento en [Allium](https://github.com/mediafranca).
- `.github/workflows/release.yml`: compila y publica los instaladores al etiquetar `vX.Y.Z`.

Contribuciones: ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Nombre

Por Luca Pacioli, que en *Divina proportione* (1509) estudió la construcción
geométrica de las letras. El ícono es su «L».

## Vera

Luca forma parte de [MediaFranca](https://github.com/mediafranca) y es el editor
externo de [Vera](https://github.com/mediafranca/vera). Vera abre un `.md` en
Luca; Luca lo guarda tal cual. Luca funciona igual sin Vera.

## Licencia

Obra de [Herbert Spencer González](https://github.com/hspencer), bajo la
[EUPL 1.2](LICENSE).

<div align="center">
<img src="assets/raised-fist.svg" width="56" alt="Puño alzado"><br>
<sub>Puño alzado: Eugenio Hansen, OFS,
<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, vía
<a href="https://commons.wikimedia.org/w/index.php?curid=65787095">Wikimedia Commons</a>.</sub>
</div>
