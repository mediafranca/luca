# Contribuir a Luca

Gracias por tu interés en Luca, el editor Markdown de [Vera](https://github.com/mediafranca)
dentro del ecosistema MediaFranca. Las contribuciones —código, documentación,
reporte de errores o ideas— son bienvenidas.

## Entorno de desarrollo

Necesitas [Rust](https://rustup.rs) (con la CLI de Tauri 2) y [Node.js](https://nodejs.org).

```bash
git clone https://github.com/mediafranca/luca
cd luca
npm install          # dependencias del frontend (mermaid, codemirror, esbuild…)
cargo tauri dev      # levanta la app; 'npm run vendor' corre solo (beforeDevCommand)
```

Para empaquetar la app nativa del sistema actual:

```bash
cargo tauri build
```

## Estructura

- `ui/` — frontend (HTML/CSS/JS). El editor es CodeMirror; la fuente del bundle
  está en `ui/editor.src.js` y se empaqueta con esbuild a `ui/vendor/`.
- `src-tauri/` — cáscara nativa (Rust + Tauri).
- `specs/` — especificación [Allium](https://github.com/mediafranca) del comportamiento.
- `scripts/vendor.mjs` — vendoriza mermaid/marked y empaqueta CodeMirror.

`ui/vendor/` y `node_modules/` no se versionan: se regeneran con `npm run vendor`.

## Especificación primero

El comportamiento de Luca vive en `specs/*.allium`. Si tu cambio altera lo que
Luca hace (no sólo cómo lo hace), **actualiza la spec** y valida:

```bash
allium check specs/
```

Respeta el contrato con Vera que la spec recoge: Luca guarda el Markdown tal cual
(sin inyectar metadatos), preserva la sintaxis que no entiende, nunca borra el
archivo y una apertura nueva no cierra las ya abiertas.

## Estilo

- Cambios pequeños y enfocados; prefiere la solución más simple que funcione.
- Sin dependencias nuevas para lo que resuelven unas pocas líneas.
- Deja el `.md` del usuario intacto: ninguna normalización silenciosa al guardar.

## Pull requests

1. Crea una rama desde `main`.
2. Describe el *qué* y el *porqué*; enlaza el issue si lo hay.
3. Verifica que compila (`cargo tauri dev`) y que `allium check specs/` pasa.

## Licencia de las contribuciones

Al contribuir aceptas que tu aporte se publique bajo la **EUPL 1.2**, la misma
licencia del proyecto (ver [LICENSE](LICENSE)).
