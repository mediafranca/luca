# Línea base de rendimiento

Medición reproducible del árbol de desarrollo al 21 de octubre de 2026, antes
de optimizar la carga de la vista previa:

| Recurso distribuido | Tamaño sin comprimir |
| --- | ---: |
| `ui/` completo | 15.4 MB |
| `ui/vendor/` | 13.4 MB |
| Mermaid | 5.4 MB |
| ELK | 2.5 MB |
| ZenUML | 3.3 MB |
| tidy-tree | 12 kB |
| icono de interfaz anterior (1024 px) | 1.29 MB |
| icono de interfaz actual (512 px) | 312 kB |

Los valores se obtienen con `du -sb` y `find -printf %s`; miden bytes del árbol
instalado y no el tamaño comprimido del instalador. `node_modules/` y
`src-tauri/target/` no forman parte de la aplicación distribuida.

Marked y Mermaid se importan al entrar por primera vez en una vista con preview.
ELK, tidy-tree y ZenUML sólo se importan si el documento los menciona. Cada
documento versiona su render y descarta resultados obsoletos.

Se mantienen los tres motores en todos los paquetes: hacerlos descargables
rompería el contrato offline y añadiría una segunda política de red. La carga
diferida evita su coste de arranque sin convertir el mismo documento en algo
dependiente del equipo donde se abre. Esta decisión debe revisarse si las
mediciones de instalador o memoria muestran un beneficio mayor que ese coste.

## Matriz manual pendiente

El tiempo de arranque, memoria con 1/10/50 pestañas y latencia de escritura
requieren una compilación nativa y herramientas del sistema. Para comparar
versiones se debe usar el mismo equipo, una compilación release y documentos de
tamaño fijo; registrar mediana de cinco arranques, memoria estable después de
30 segundos y percentiles 50/95 de escritura. No se publica una cifra obtenida
en navegador porque no representa el WebView ni el proceso Rust.
