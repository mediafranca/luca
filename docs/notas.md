# Pendientes

Notas de trabajo, fuera de git (`.gitignore`). No es documentación del
proyecto: es la lista de lo que quedó abierto, con lo que se midió y lo que no.

Última actualización: 23 de octubre de 2026, tras publicar v0.7.3.

---

## 1. Decisiones que esperan respuesta

### v0.7.2 está publicado sin macOS
El job de macOS murió en el paso de firma, así que ese release tiene Windows y
Linux pero **ningún** artefacto de macOS: ni `.dmg`, ni `.app.tar.gz`, ni su
archivo de checksums. v0.7.3 ya lo reemplaza por completo.

- **Opción A:** borrar el release y la etiqueta, como se hizo con v0.7.0
  (`gh release delete v0.7.2 --cleanup-tag`). Es destructivo e irreversible:
  desaparecen los cinco artefactos de Windows y Linux y sus enlaces.
- **Opción B:** dejarlo. Queda un release incompleto visible bajo v0.7.3.

### Notarización de macOS
Es **lo único que arregla el doble clic**. Medido, no supuesto: con la cuarentena puesta a mano, un bundle firmado ad-hoc se atasca igual en `_dyld_start` con 96 K de footprint. La firma ad-hoc que ya hace el CI mejora
el bundle (ver §3) pero no quita el cuelgue.

Lo que haría falta:
1. Cuenta del Apple Developer Program (~99 USD/año) y un certificado
   **Developer ID Application**, exportado como `.p12`.
2. Secretos en GitHub: `APPLE_CERTIFICATE` (el `.p12` en base64),
   `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` con el nombre exacto
   que devuelva `security find-identity -v -p codesigning`.
3. Para notarizar, uno de los dos juegos: `APPLE_ID` + `APPLE_PASSWORD`
   (contraseña específica de app) + `APPLE_TEAM_ID`, o bien
   `APPLE_API_ISSUER` + `APPLE_API_KEY` + `APPLE_API_KEY_PATH`.

> **Trampa ya pisada, no repetir.** Esas variables **no** se pueden poner como
> `${{ secrets.X }}` en el bloque `env` del paso de `tauri-action`. Un secreto
> inexistente no deja la variable sin definir: **la define vacía**, Tauri
> comprueba si existe y no si trae contenido, intenta importar un `.p12` vacío
> y el build de macOS muere. Fue exactamente el fallo de v0.7.2. Hay que
> definirlas en un paso aparte que escriba en `$GITHUB_ENV` sólo si el secreto
> trae algo.

Estado local: `notarytool` ya está instalado (Command Line Tools);
`security find-identity -v -p codesigning` devuelve **0 identidades válidas**.

### Flatpak y Flathub
Paso a paso completo en el **anexo A**, al final de este documento.

### Cask de Homebrew
La vía que no cuesta nada. Un cask puede quitar la cuarentena al instalar, así
que `brew install --cask luca` dejaría la app funcionando sin que nadie toque
`xattr`. No arregla el doble clic sobre un DMG bajado a mano, pero da una ruta
de instalación limpia. Sin empezar.

### Los ocho avisos de `documento.allium`
`allium check` informa de ocho `unreachableTrigger`: las reglas escuchan
disparadores que ninguna superficie **del mismo archivo** provee, porque las
superficies viven en `vista-previa.allium`. No es un error, es el precio de
separar modelo y fronteras.

- **Opción A:** mover la superficie `Editor` a `documento.allium`. Desaparecen
  los ocho avisos; el archivo pasa de 245 a unas 340 líneas y se pierde la
  separación.
- **Opción B:** dejarlos. Son informativos.

---

## 2. Verificación que falta (nada de esto se ha ejecutado en Tauri)

Todo lo construido en la sesión del 22–23 de octubre descansa en 53 tests de
Node, 17 de Rust, `cargo check`, `cargo clippy`, `allium check` y
comprobaciones con `curl` contra Casiopea. **La app no se ha abierto para
comprobarlo.** Lo que hay que mirar a mano, por orden de riesgo:

1. **Cambio de idioma.** Es el único camino que cruza el IPC, rehace el menú
   nativo completo y repuebla los recientes. Mirar que el menú cambie, que los
   recientes no desaparezcan, y que arrancando en un sistema en inglés todo
   salga ya traducido sin parpadeo del español.
2. **Comando `luca` en Preferencias ▸ Generales.** Los cinco estados: ya en el
   PATH, enlazado, ocupado por otro, ausente, sin carpeta escribible. Y que
   «Quitar» no borre un `luca` ajeno.
3. **Muestra de tema.** Que enseñe el tema oscuro mientras la pantalla está en
   claro. Que se repinte al tocar un color **y** al cambiar tipografía o cuerpo
   en Generales. Que no robe el foco del selector de color al arrastrarlo.
4. **Wiki con sus CSS.** Que el claro/oscuro responda ahora (14 reglas de tema
   recuperadas), y que la tipografía resuelva a las familias empaquetadas.
5. **PDF en tema oscuro** con un fence ```mermaid: el papel debe salir claro y
   el diagrama legible; al cerrar el diálogo la pantalla vuelve a oscuro sola.
6. **Reordenar pestañas arrastrando** una pestaña no activa: debe reordenar sin
   activarla. El `×` no debe activar antes de cerrar.
7. **Diseños:** crear, duplicar, renombrar, eliminar, exportar e importar.
   Importar debe **añadir**, nunca pisar el activo.
8. **⌘E y Ctrl+E** con el foco dentro del editor.

---

## 3. Limitaciones conocidas (no son bugs, son el límite de lo posible)

- **Gatekeeper.** Sin notarizar, un DMG bajado con navegador rebota en el Dock
  sin mensaje. Remedio: `xattr -cr /Applications/Luca.app`. «Abrir de todos
  modos» en Ajustes **no basta**: autoriza la apertura pero no quita el
  atributo de cuarentena. Está en el README y en las notas del release.
- **Temas de wiki por media query.** Una skin que elija su paleta sólo con
  `@media (prefers-color-scheme)` seguirá al sistema operativo, no al
  interruptor de Luca. Las media queries no se pueden reescribir desde fuera.
  Stella Nova usa `light-dark()`, así que en Casiopea sí responde.
- **Fuentes web de la wiki.** No se descargan (CSP `font-src 'self' data:`).
  Resuelven contra las que empaqueta Luca —IBM Plex Sans, IBM Plex Mono y
  Roboto Serif son justo las que pide Stella Nova— y si no, contra la pila del
  sistema que la propia wiki nombre. Abrir el CSP a `font-src https:` sería la
  alternativa.
- **Build local sin cuarentena.** Compilar en local corre sin trucos porque
  nunca pasa por un navegador, no porque el binario sea distinto. Subir un
  build local al release **no** ayudaría a nadie: al bajarlo se le pega la
  cuarentena igual, rompería la cadena de checksums generada en CI, no sería
  reproducible desde la etiqueta, y `cargo tauri build` sin
  `--target universal-apple-darwin` sale *thin* (sin Intel).

---

## 4. Deuda pequeña, concreta

- **`AGENTS.md:104`** sigue diciendo «No hay un script `npm test` ni una suite
  de tests propia en el árbol revisado». Es falso: hay 53 tests en
  `tests/*.test.mjs` más `scripts/check-packaging.mjs`. Por creer esa línea no
  se corrió la suite al empezar la sesión y se publicó una v0.7.0 con un test
  roto. **Corregir.**
- **`ui/app.js:870`** — reunir ventanas usa `Promise.all`, que informa sólo del
  primer fallo. Las demás transferencias igual se completan (por eso
  `ReunirNoPierdeNada` se sostiene), pero si fallan dos sólo se ve una alerta.
  `Promise.allSettled` lo arregla, a costa de varias alertas.
- **Renombrar un diseño** se hace por el campo «Nombre del diseño actual». No
  hay botón «Renombrar» porque no se pidió; si se echa en falta, es trivial.
- **`luca --help` está en español.** Se imprime antes de que exista un idioma
  elegido, así que no pasa por el catálogo. Los `console.warn` también siguen
  en español, eso a propósito: son para quien depura.
- **El `.msi` añade su carpeta al PATH, el `-setup.exe` (NSIS) no.** Verificado
  extrayendo los instaladores. Si se quiere paridad, hay que configurar el
  instalador NSIS o dejar que lo resuelva la Preferencia del comando.

---

## 5. Avisos del linter que se dejan a propósito

No son divergencias; son la convención del proyecto. Anotados para no volver a
investigarlos cada vez:

- **`Autor` sin módulo gobernante** y `Autor.id` / `Vera.id` sin referenciar.
  Luca es local y monousuario: no hay cuentas ni sesiones, y ninguna regla
  necesita preguntar *cuál* autor. Quitarle el campo empeora el recuento del
  linter (cambia un `info` por un `warning`). El motivo está escrito en la spec.
- **Dos `unusedBinding`** (`autor` en `VistaRenderizadaEditable`, `vera` en
  `LanzamientoVera`). La convención es que el actor va implícito en el nombre
  del disparador (`AutorAbreArchivo`, `AutorGuarda`). Meterlo como parámetro
  sería ceremonia para contentar al linter.

---

## 6. Rutina antes de etiquetar un release

Los cuatro pasos que corre el CI, en local y en este orden. Dos releases
fallidos salieron de no hacerlo:

```sh
npm ci
npm test                                        # 53 tests + check-packaging
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Y de propina, aunque el CI no los exija:

```sh
cargo test --manifest-path src-tauri/Cargo.toml  # 17 tests
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets
allium check specs/
```

Al subir la versión hay **cinco** sitios, no cuatro: `package.json`,
`package-lock.json` (dos claves: la raíz y `packages[""]`), `tauri.conf.json` y
`Cargo.toml`. `check-packaging.mjs` lo verifica. Cuidado con reemplazar
`"version": "X"` a ciegas en el lockfile: alguna dependencia puede compartir el
número — ya pasó con 0.7.1.

---

# Anexo A — Flatpak, paso a paso

Escrito asumiendo cero conocimiento previo. Los nombres de archivo y el proceso
de Flathub están verificados contra las fuentes del 23 de octubre de 2026
(enlaces al final). Dos advertencias antes de empezar:

> **Esto no se puede hacer desde el Mac.** `flatpak` y `flatpak-builder` son
> sólo de Linux. Hace falta una máquina Linux, una VM o un contenedor. Lo único
> que sí se hace en este repo —desde cualquier sistema— es crear los dos
> archivos del paso 2.

> **Flatpak no sufre el problema de Gatekeeper.** Eso es exclusivo de macOS. Un
> Flatpak no necesita firma de Apple ni nada parecido.

## Qué es cada cosa, en una línea

- **Flatpak**: un formato de paquete para Linux que funciona en cualquier
  distribución, porque trae sus dependencias dentro.
- **Flathub**: la tienda donde vive la mayoría de los Flatpaks. Publicar ahí es
  abrir un *pull request* a un repositorio suyo; ellos lo revisan y, si pasa,
  crean un repositorio propio para la app y la construyen ellos.
- **Manifiesto**: un YAML que describe cómo armar el paquete. No compila Luca
  desde cero: coge el `.deb` que ya publica el CI y lo desempaqueta dentro.
- **Runtime**: la base compartida (GTK, WebKit…) sobre la que corre la app. Para
  una app Tauri es `org.gnome.Platform`, que ya trae `webkit2gtk`; por eso el
  manifiesto no necesita compilar WebKit.

## Paso 0 — Comprobar que el identificador sirve

Flathub exige que el ID sea un dominio en orden inverso, que lo controles tú y
que responda por HTTPS. El de Luca ya cumple:

- ID: **`net.mediafranca.luca`** (el mismo `identifier` de `tauri.conf.json`,
  así que no hay que cambiar nada).
- `https://mediafranca.net/` responde **HTTP 200** — comprobado.
- Tres componentes, sólo minúsculas, sin terminar en `.app` ni `.desktop`. ✓

**Ese ID tiene que aparecer idéntico en tres sitios**: el nombre del archivo del
manifiesto, la etiqueta `<id>` del metainfo, y el campo `id:` del manifiesto. Si
uno no coincide, Flathub lo rechaza.

## Paso 1 — Instalar las herramientas (en la máquina Linux)

```sh
# Debian / Ubuntu
sudo apt install flatpak flatpak-builder
# Fedora
sudo dnf install flatpak flatpak-builder
# Arch
sudo pacman -S --needed flatpak flatpak-builder
```

Averiguar **cuál es el runtime vigente** — Flathub rechaza cualquiera que esté
fuera de soporte, y exige el más reciente al momento de enviarlo:

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remote-info flathub org.gnome.Platform
```

Lo que diga ese comando es el número que va en `runtime-version`. **No copiar un
número de esta guía**: en octubre de 2026 la rama vigente parecía ser la 50 y la
48 ya estaba fuera de soporte, pero cambia una vez al año. Instalar esa versión:

```sh
flatpak install flathub org.gnome.Platform//50 org.gnome.Sdk//50   # cambiar 50
```

## Paso 2 — Los dos archivos que van en ESTE repo

Crear una carpeta `flatpak/` en la raíz del proyecto. Van versionados en git
(el que no va a git es sólo este documento de pendientes).

### 2a. `flatpak/net.mediafranca.luca.metainfo.xml`

Describe la app para la tienda: nombre, resumen, descripción, capturas,
licencia, historial de versiones. **Es obligatorio** para que Luca aparezca en
la web de Flathub, y tiene que pasar la validación.

La forma más segura de redactarlo sin pelearse con el formato es el generador
oficial: <https://www.freedesktop.org/software/appstream/metainfocreator/#/>.
Rellena el formulario y descarga el XML. Datos de Luca para el formulario:

| Campo | Valor |
| --- | --- |
| ID | `net.mediafranca.luca` |
| Nombre | Luca |
| Resumen | Editor de Markdown y Wikitext |
| Licencia del proyecto | `EUPL-1.2` |
| Licencia del metainfo | `CC0-1.0` |
| Desarrollador | MediaFranca |
| Página | `https://github.com/mediafranca/luca` |

Importante: el `<id>` debe ser exactamente `net.mediafranca.luca`, debe llevar
un `<launchable type="desktop-id">net.mediafranca.luca.desktop</launchable>`, y
la licencia declarada tiene que coincidir con la del código (EUPL 1.2).

Conviene además **meterlo dentro del `.deb`**, porque Flathub prefiere que estos
metadatos vivan en el proyecto y no copiados en la solicitud. Eso se hace en
`src-tauri/tauri.conf.json`:

```json
"bundle": {
  "linux": {
    "deb": {
      "files": {
        "/usr/share/metainfo/net.mediafranca.luca.metainfo.xml":
          "../flatpak/net.mediafranca.luca.metainfo.xml"
      }
    }
  }
}
```

### 2b. `flatpak/net.mediafranca.luca.yml`

El manifiesto. **El nombre del archivo debe ser el ID más `.yml`** — eso lo
exige Flathub literalmente. Plantilla adaptada a Luca, con tres huecos marcados:

```yaml
id: net.mediafranca.luca
runtime: org.gnome.Platform
runtime-version: '50'          # ← lo que diga `flatpak remote-info`
sdk: org.gnome.Sdk
command: luca

finish-args:
  - --socket=wayland           # ventana en Wayland
  - --socket=fallback-x11      # ventana en X11
  - --share=ipc
  - --device=dri               # aceleración gráfica
  - --share=network            # la vista previa Wikitext consulta la wiki
  - --filesystem=home          # abrir y guardar los .md del autor

modules:
  - name: luca
    buildsystem: simple
    sources:
      - type: file
        path: net.mediafranca.luca.metainfo.xml
      - type: file
        url: https://github.com/mediafranca/luca/releases/download/v0.7.3/Luca_0.7.3_amd64.deb
        sha256: 8fcd39bed0c9634c627adde2698ba283f2607c505cfe9b3b2637378b99bc13d9
        only-arches: [x86_64]
    build-commands:
      - set -e
      - mkdir deb-extract
      - ar -x *.deb --output deb-extract
      - tar -C deb-extract -xf deb-extract/data.tar.gz
      - install -Dm755 deb-extract/usr/bin/luca /app/bin/luca
      - sed -i 's/^Icon=.*/Icon=net.mediafranca.luca/' deb-extract/usr/share/applications/Luca.desktop
      - install -Dm644 deb-extract/usr/share/applications/Luca.desktop /app/share/applications/net.mediafranca.luca.desktop
      - install -Dm644 deb-extract/usr/share/icons/hicolor/32x32/apps/luca.png /app/share/icons/hicolor/32x32/apps/net.mediafranca.luca.png
      - install -Dm644 deb-extract/usr/share/icons/hicolor/128x128/apps/luca.png /app/share/icons/hicolor/128x128/apps/net.mediafranca.luca.png
      - install -Dm644 deb-extract/usr/share/icons/hicolor/256x256@2/apps/luca.png /app/share/icons/hicolor/256x256@2/apps/net.mediafranca.luca.png
      - install -Dm644 net.mediafranca.luca.metainfo.xml /app/share/metainfo/net.mediafranca.luca.metainfo.xml
```

Notas sobre ese manifiesto:

- **Las rutas del `.deb` están verificadas**, no inventadas: se extrajo el
  paquete real de v0.7.1 y contiene `usr/bin/luca`,
  `usr/share/applications/Luca.desktop` y los iconos en
  `usr/share/icons/hicolor/{32x32,128x128,256x256@2}/apps/luca.png`.
- **El `sha256` del `.deb` ya lo publica el CI.** Está en el asset
  `checksums-Linux-X64.txt` de cada release, primera columna de la línea del
  `.deb`. El valor de arriba es el real de v0.7.3. **Hay que actualizar la URL y
  el sha256 en cada versión nueva.**
- `--share=network` y `--filesystem=home` no venían en la plantilla de Tauri;
  los añado porque Luca los necesita de verdad: la vista previa Wikitext sale a
  la red, y el editor abre y guarda archivos del autor. Flathub revisa los
  permisos y pregunta por los que parezcan excesivos, así que conviene poder
  justificar cada uno.
- Si en el futuro Luca lleva icono en la bandeja del sistema, hay que añadir
  `--talk-name=org.kde.StatusNotifierWatcher` y
  `--filesystem=xdg-run/tray-icon:create`.
- Si la ventana sale negra en Wayland, probar
  `--env=WEBKIT_DISABLE_COMPOSITING_MODE=1`.

## Paso 3 — Construir y probar en local (en la Linux)

Desde la carpeta `flatpak/`:

```sh
flatpak-builder --force-clean --user --disable-cache   --repo flatpak-repo build-dir net.mediafranca.luca.yml

flatpak --user remote-add --no-gpg-verify luca-local flatpak-repo
flatpak --user install luca-local net.mediafranca.luca
flatpak run net.mediafranca.luca
```

Para probar sin subir nada todavía, se puede sustituir el bloque `url:` +
`sha256:` por un `.deb` local:

```yaml
      - type: file
        path: Luca_0.7.3_amd64.deb
```

Antes de enviarlo, pasar el linter que usa Flathub:

```sh
flatpak install flathub org.flatpak.Builder
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest net.mediafranca.luca.yml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder repo flatpak-repo
```

Que esto pase **antes** de abrir el PR ahorra una ronda de revisión.

## Paso 4 — Enviarlo a Flathub

Aquí no se sube nada a nuestro repo: se abre un PR al de ellos.

1. Entrar en <https://github.com/flathub/flathub> y hacer **Fork**,
   **desmarcando** la casilla «Copy the master branch only».
2. Clonar el fork en la rama `new-pr`:

   ```sh
   git clone --branch=new-pr git@github.com:TU_USUARIO/flathub.git && cd flathub
   ```

   O con la CLI de GitHub:

   ```sh
   gh repo fork --clone flathub/flathub && cd flathub      && git checkout --track origin/new-pr
   ```

3. Crear una rama para la solicitud:

   ```sh
   git checkout -b luca-submission new-pr
   ```

4. Copiar **al nivel superior** del repositorio los dos archivos del paso 2:

   ```
   net.mediafranca.luca.yml
   net.mediafranca.luca.metainfo.xml
   ```

   Si Luca sólo se publica para x86_64, añadir también un `flathub.json` al
   mismo nivel declarándolo. **No incluir código fuente ni binarios.**

5. Commit, push, y abrir el pull request **contra la rama `new-pr`**, no contra
   `master`. Título exacto: `Add net.mediafranca.luca`.

6. Revisores voluntarios comentarán. Hay que responder a todo. No cerrar el PR
   para corregir, ni mezclar `master` en la rama. Cuando esté resuelto,
   comentar literalmente `bot, build` para lanzar una construcción de prueba.
   Las capturas no se ven en las construcciones de prueba, sólo al publicar.

7. Si lo aprueban, crean un repositorio nuevo en la organización Flathub y te
   invitan. **Hay que activar 2FA en GitHub y aceptar la invitación en una
   semana.** A partir de ahí, cada versión nueva se publica abriendo un PR a
   ese repositorio con la URL y el sha256 del `.deb` nuevo.

## Lo que esto implica como trabajo recurrente

Cada release habría que actualizar `url:` y `sha256:` en el manifiesto de
Flathub. Se puede automatizar más adelante, pero conviene saber que no es
«publicar y olvidarse».

## Enlaces

- Guía de Flatpak para Tauri 2: <https://v2.tauri.app/distribute/flatpak/>
- Enviar una app a Flathub: <https://docs.flathub.org/docs/for-app-authors/submission>
- Requisitos y archivos obligatorios: <https://docs.flathub.org/docs/for-app-authors/requirements>
- Mantener la app ya publicada: <https://docs.flathub.org/docs/for-app-authors/maintenance>
- Generador de metainfo: <https://www.freedesktop.org/software/appstream/metainfocreator/#/>
- Runtimes disponibles: <https://docs.flatpak.org/en/latest/available-runtimes.html>
