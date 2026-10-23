# Distribución de Luca

## Homebrew (macOS)

`Casks/luca.rb` instala el DMG universal de v0.7.3 y enlaza el comando `luca`.
Su SHA-256 procede de `checksums-macOS-ARM64.txt` del release. El cask está
preparado para un tap propio; aún no se ha publicado ni probado en macOS.

Cuando estos archivos estén integrados y publicados en GitHub, el repositorio
puede añadirse como tap mediante URL explícita:

```sh
brew tap mediafranca/luca https://github.com/mediafranca/luca.git
brew install --cask mediafranca/luca/luca
```

Antes de anunciarlo, en un Mac:

```sh
brew style --cask mediafranca/luca/luca
brew audit --cask mediafranca/luca/luca
brew install --cask mediafranca/luca/luca
luca --version
```

Comprobar además apertura gráfica y apertura de archivos. Luca sigue sin
notarizar: Homebrew aplica cuarentena y no sustituye la notarización. Consulta
el procedimiento de apertura del README. El cask no elimina atributos desde
un script de instalación ni promete estar admitido en `homebrew/cask`.

## Flatpak local (Linux x86_64)

`flatpak/local.yml` reutiliza el `.deb` publicado de v0.7.3 con su SHA-256.
Usa GNOME 51, disponible en Flathub el 23 de octubre de 2026. No es un
manifiesto apto para enviar a Flathub. El metainfo se incluye también en los
futuros `.deb` mediante la configuración de Tauri.

Con flatpak-builder instalado:

```sh
flatpak install flathub org.gnome.Platform//51 org.gnome.Sdk//51
cd flatpak
flatpak-builder --force-clean --user --repo=flatpak-repo build-dir local.yml
flatpak build-bundle flatpak-repo Luca.flatpak net.mediafranca.luca
flatpak install --user ./Luca.flatpak
flatpak run net.mediafranca.luca
```

El acceso a red permite consultar MediaWiki. El acceso a home permite abrir,
guardar y reabrir archivos propios y observar modificaciones externas; no
alcanza discos externos. Antes de publicar en una tienda, revisar los portales
y minimizar permisos. Probar Wayland/X11, abrir/guardar/reabrir, cambios
externos, Mermaid offline, preview MediaWiki y claro/oscuro dentro del sandbox.

## Flathub

`flatpak/net.mediafranca.luca.yml` queda deliberadamente vacío para que el
mantenedor escriba su manifiesto. No se construye ni se valida como paquete.
Las notas privadas de trabajo reúnen requisitos y ejemplos reales; no se
publican en este repositorio.
El metainfo y el manifiesto local de esta sesión son asistidos por IA; no deben
presentarse como escritos manualmente.

La política vigente exige fuentes y dependencias descargables con versiones
fijadas, compilación sin red y un manifiesto sin asistencia de IA. También
prohíbe que agentes generen o automaticen solicitudes y respuestas de revisión.
El mantenedor debe escribir y tramitar la solicitud. Declarar IA en el resto
del proyecto no garantiza aceptación ni elimina la restricción del manifiesto.

## Actualizar un release

Tras publicar un release completo, descargar sus `checksums-*.txt`, verificar
los archivos y actualizar por separado la versión y SHA-256 del cask y la URL y
SHA-256 del Flatpak local. Actualizar el historial del metainfo cuando
corresponda. No cambiar esas referencias a un release que aún no existe.

## Fuentes

- [Cask Cookbook](https://docs.brew.sh/Cask-Cookbook)
- [Seguridad de Homebrew](https://docs.brew.sh/Homebrew-Security-and-Supply-Chain)
- [Flatpak en Tauri](https://v2.tauri.app/distribute/flatpak/)
- [Requisitos de Flathub](https://docs.flathub.org/docs/for-app-authors/requirements)
- [Envío a Flathub](https://docs.flathub.org/docs/for-app-authors/submission)
