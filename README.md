<div align="center">

<img src="icon.png" width="140" alt="Luca">

# Luca

**Un editor Markdown completo, rápido y soberano**
</div>

Luca es un editor de texto Markdown para el escritorio. Escribes en texto
plano, ves el resultado al instante y el archivo es tuyo: un `.md` corriente
que puedes abrir con cualquier otra herramienta, hoy o dentro de veinte años.
No hay cuenta, no hay nube, no hay formato propietario.

## Descargar

Luca funciona en macOS, Windows y Linux. Los instaladores están en la página de
versiones de GitHub:

**[Descargar la última versión →](https://github.com/mediafranca/luca/releases/latest)**

En esa página, baja hasta **Assets** y elige el archivo de tu sistema:

| Sistema | Archivo | Después de descargar |
| --- | --- | --- |
| macOS con chip Apple (M1, M2, M3, M4…) | `Luca_x.y.z_aarch64.dmg` | Abre el `.dmg` y arrastra Luca a Aplicaciones. |
| macOS con chip Intel | `Luca_x.y.z_x64.dmg` | Igual que arriba. |
| Windows | `Luca_x.y.z_x64-setup.exe` (o el `.msi`) | Ejecuta el instalador. |
| Linux | `.AppImage` (cualquier distribución), `.deb` (Debian, Ubuntu) o `.rpm` (Fedora) | Dale permiso de ejecución al AppImage o instala el paquete. |

**Si macOS dice que Luca «está dañada» o «no se puede abrir».** Luca todavía
no está firmada con un certificado de Apple, y macOS desconfía de las apps
descargadas sin firma. No está dañada. Prueba primero con clic derecho sobre
Luca en Aplicaciones y **Abrir**. Si el aviso sigue, abre la app Terminal, pega
esta línea y pulsa Intro:

```bash
xattr -cr /Applications/Luca.app
```

A partir de ahí Luca abre con normalidad. Windows puede mostrar un aviso
parecido de SmartScreen: pulsa «Más información» y luego «Ejecutar de todas formas».

## Qué hace

- **Tres vistas**: código Markdown, vista dividida y texto renderizado
  (`⌘1`, `⌘2`, `⌘3`). En la vista dividida puedes arrastrar el divisor y la
  vista previa sigue al cursor.
- **Edición sobre el texto renderizado**: en la vista renderizada pulsas un
  párrafo, un título, una tabla o un diagrama y lo editas ahí mismo, con la
  misma tipografía. El archivo sigue siendo Markdown puro.
- **Modo zen** a pantalla completa, sin barras (`⌘⇧Z`, `Esc` para salir).
- **Barra de herramientas**: encabezados, negrita, cursiva, listas, citas,
  enlaces, bloques de código y un editor visual de tablas que acepta pegar
  desde una hoja de cálculo.
- **Diagramas Mermaid** renderizados sin conexión (flujos, secuencias, ELK,
  ZenUML). El diagrama se guarda como texto, nunca como imagen.
- **Varios documentos en pestañas**, guardado seguro (nunca pisa a medias un
  archivo) y aviso si otro programa cambió el archivo mientras lo editabas.
- **Exportar a PDF** desde el menú Archivo.
- **Tipografía y colores configurables** (`⌘,`), con modo claro y oscuro.
- Se registra como editor de archivos `.md`, así que «Abrir con…» lo encuentra.

![Captura de pantalla de Luca](./assets/luca-screenshot.png)

## El nombre

Luca toma su nombre de Luca Pacioli, fraile franciscano y matemático del
Renacimiento. En [*Divina proportione*](https://archive.org/download/divinaproportion00paci/divinaproportion00paci.pdf)
(1509) incluyó un estudio sobre la construcción geométrica de las letras
capitales: una manera de entender la escritura desde su forma, sus proporciones
y el cuidado de sus trazos. El ícono de Luca es su «L». La intención de diseño
es la misma: un entorno claro y proporcionado cuya forma acompañe el trabajo de
quien escribe.

## Correr desde el código

Necesitas [Rust](https://rustup.rs) con la CLI de Tauri 2 y [Node.js](https://nodejs.org).

```bash
npm install
cargo tauri dev
```

Para empaquetar la app del sistema actual:

```bash
cargo tauri build
```

Los instaladores de la página de versiones los compila GitHub Actions
(`.github/workflows/release.yml`) cada vez que se publica una etiqueta `vX.Y.Z`.

## Estructura

- `ui/` — interfaz (HTML/CSS/JS; CodeMirror 6 empaquetado con esbuild).
- `src-tauri/` — cáscara nativa (Rust + Tauri 2).
- `specs/` — especificación [Allium](https://github.com/mediafranca) del comportamiento.
- `scripts/vendor.mjs` — vendoriza mermaid/marked y empaqueta CodeMirror en `ui/vendor/`.
- `icon.png` — fuente del ícono; regenerar el set con `cargo tauri icon icon.png`.

## Especificación (Allium)

El comportamiento de Luca está descrito en `specs/*.allium`:

- `luca.allium` — módulo raíz.
- `documento.allium` — documentos, pestañas y ciclo de vida.
- `vista-previa.allium` — editor y vista previa.
- `edicion-renderizada.allium` — edición por bloques sobre el texto renderizado.
- `vera.allium` — convivencia con Vera.

Validar con `allium check specs/`.

## Contribuir

Las contribuciones son bienvenidas: ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Luca y Vera

Luca nace dentro de [MediaFranca](https://github.com/mediafranca) y es el editor
externo predeterminado de [Vera](https://github.com/mediafranca/vera). Esa
relación no cambia nada de lo anterior: Vera abre un `.md` en Luca por «Abrir
con…», Luca lo guarda tal cual, sin inyectar metadatos ni normalizar nada, y
nunca borra ni toca el grafo de Vera. Luca sirve igual sin Vera.

<div align="center">
<img src="assets/raised-fist.svg" width="70" alt="Puño alzado"><br>Aplicación soberana
<br><sub>Puño alzado: Eugenio Hansen, OFS — trabajo propio,
<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, vía
<a href="https://commons.wikimedia.org/w/index.php?curid=65787095">Wikimedia Commons</a>.</sub>
</div>

## Autoría y licencia

Luca es obra de [Herbert Spencer González](https://github.com/hspencer).
Publicado bajo la [Licencia Pública de la Unión Europea (EUPL 1.2)](LICENSE).
