# Privacidad y conectividad

Luca trabaja primero con archivos locales. El texto, los borradores de
recuperación, las preferencias y la lista de archivos recientes permanecen en
el equipo. Luca no tiene telemetría y no envía documentos a MediaFranca.

## Cuándo usa la red

- La vista previa Markdown, Mermaid, las fuentes y los recursos de la interfaz
  se distribuyen con la aplicación y funcionan sin conexión. No existe un
  respaldo CDN.
- La vista previa Wikitext es la única conexión funcional actual. Al abrirla,
  Luca envía el texto y el título de contexto mediante HTTPS a la API MediaWiki
  elegida en Preferencias. La interfaz muestra la wiki, actualización, caché y
  errores. La edición fuente sigue disponible sin red.
- Luca no reutiliza cookies ni sesiones del navegador, no envía credenciales y
  rechaza endpoints de previsualización que no sean HTTPS.
- Los enlaces se abren explícitamente en el navegador predeterminado; nunca
  reemplazan la interfaz de Luca.
- Los recursos relativos se autorizan uno por uno y sólo para extensiones
  multimedia; el protocolo local no expone un scope global. La directiva
  `style-src 'unsafe-inline'` se conserva porque la interfaz y los tokens de
  diseño generan estilos locales, no para admitir contenido de documentos.
- Esta versión no incorpora actualización automática. Una futura actualización
  deberá ser verificable, diferenciada de la preview y documentada antes de
  activarse.

La wiki configurada puede registrar solicitudes según su propia política. Para
contenido que no deba salir del equipo, usa modo fuente o una wiki bajo tu
control.

## Diagnóstico

**Preferencias → Exportar diagnóstico…** crea un JSON revisable antes de
compartir. Incluye versión, plataforma, esquema de preferencias, capacidades y
conteos de pestañas por estado/formato. No incluye texto, nombres o rutas de
archivos, recientes, URL de la wiki, cookies, credenciales ni tokens de diseño.

## Datos locales y recuperación

El WebView conserva preferencias, formatos asociados a rutas, recientes y una
instantánea de recuperación para documentos con cambios. Recuperar crea una
pestaña sucia y nunca reemplaza automáticamente el archivo original. Para
eliminar estos datos, desinstala Luca y borra sus datos de aplicación con las
herramientas del sistema. Su ubicación depende de macOS, Windows o Linux y del
WebView; los documentos guardados no se eliminan junto con esos datos.

Las migraciones llevan una versión de esquema, son incrementales y conservan
claves desconocidas. Antes de volver a una versión anterior conviene exportar
los tokens de diseño desde Preferencias.
