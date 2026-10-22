#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::ffi::OsString;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::{collections::HashMap, sync::atomic::AtomicUsize};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

mod file_io;
use file_io::{mtime_ms, read_text_file, write_text_file};

const MAX_WIKI_RESPONSE: u64 = 5 * 1024 * 1024;

fn navigation_allowed(scheme: &str, host: Option<&str>, debug: bool) -> bool {
    scheme == "tauri"
        || matches!(host, Some("tauri.localhost"))
        || (debug && matches!(host, Some("localhost" | "127.0.0.1")))
}

#[cfg(test)]
mod navigation_tests {
    use super::navigation_allowed;

    #[test]
    fn la_interfaz_no_navega_a_la_web() {
        assert!(navigation_allowed("tauri", Some("localhost"), false));
        assert!(navigation_allowed("https", Some("tauri.localhost"), false));
        assert!(!navigation_allowed("https", Some("example.org"), false));
        assert!(!navigation_allowed("file", None, false));
        assert!(navigation_allowed("http", Some("127.0.0.1"), true));
    }
}

#[derive(serde::Deserialize)]
struct ParseEnvelope {
    parse: Option<ParseResult>,
    error: Option<ApiError>,
}

#[derive(serde::Deserialize)]
struct ParseResult {
    text: String,
}

#[derive(serde::Deserialize)]
struct ApiError {
    info: String,
}

#[tauri::command]
async fn parse_wikitext(api_url: String, title: String, text: String) -> Result<String, String> {
    let url = reqwest::Url::parse(&api_url).map_err(|_| "URL de wiki inválida".to_string())?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("La API de la wiki debe usar HTTPS y no incluir credenciales".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() < 3 && attempt.url().scheme() == "https" {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .user_agent(concat!("Luca/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(url)
        .form(&[
            ("action", "parse"),
            ("format", "json"),
            ("formatversion", "2"),
            ("prop", "text"),
            ("disableeditsection", "1"),
            ("title", title.as_str()),
            ("text", text.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("No se pudo contactar la wiki: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("La wiki respondió HTTP {}", response.status()));
    }
    if response
        .content_length()
        .is_some_and(|n| n > MAX_WIKI_RESPONSE)
    {
        return Err("La respuesta de la wiki excede 5 MiB".into());
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_WIKI_RESPONSE {
        return Err("La respuesta de la wiki excede 5 MiB".into());
    }
    let envelope: ParseEnvelope = serde_json::from_slice(&bytes)
        .map_err(|_| "Respuesta inválida de MediaWiki".to_string())?;
    if let Some(error) = envelope.error {
        return Err(error.info);
    }
    envelope
        .parse
        .map(|parsed| parsed.text)
        .ok_or_else(|| "MediaWiki no devolvió HTML".into())
}

// Analiza tanto aperturas iniciales como argumentos reenviados por la segunda
// instancia. macOS además entrega asociaciones mediante RunEvent::Opened.
mod file_argument;

// Aperturas pendientes en frío: el sistema puede entregar varios archivos
// antes de que el frontend registre los listeners.
struct Pending {
    files: Mutex<Vec<String>>,
    new_document: AtomicBool,
}

#[derive(Default)]
struct WindowRegistry {
    next_id: AtomicUsize,
    owners: Mutex<HashMap<String, String>>,
    transfers: Mutex<HashMap<String, Vec<serde_json::Value>>>,
}

#[tauri::command]
fn create_editor_window(
    app: tauri::AppHandle,
    registry: tauri::State<WindowRegistry>,
) -> Result<String, String> {
    let id = registry.next_id.fetch_add(1, Ordering::SeqCst) + 1;
    let label = format!("editor-{id}");
    tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App("index.html".into()))
        .title("Luca")
        .inner_size(960.0, 620.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(label)
}

#[tauri::command]
fn transfer_tab(
    app: tauri::AppHandle,
    registry: tauri::State<WindowRegistry>,
    target: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    if app.get_webview_window(&target).is_none() {
        return Err("La ventana de destino ya no existe".into());
    }
    if let Some(path) = payload.get("path").and_then(|value| value.as_str()) {
        registry
            .owners
            .lock()
            .unwrap()
            .insert(path.to_string(), target.clone());
    }
    registry
        .transfers
        .lock()
        .unwrap()
        .entry(target.clone())
        .or_default()
        .push(payload);
    let _ = app.emit_to(&target, "tab-transfer-available", ());
    Ok(())
}

#[tauri::command]
fn take_transferred_tabs(
    registry: tauri::State<WindowRegistry>,
    window_label: String,
) -> Vec<serde_json::Value> {
    registry
        .transfers
        .lock()
        .unwrap()
        .remove(&window_label)
        .unwrap_or_default()
}

#[tauri::command]
fn claim_document(
    app: tauri::AppHandle,
    registry: tauri::State<WindowRegistry>,
    path: String,
    window_label: String,
) -> Option<String> {
    let mut owners = registry.owners.lock().unwrap();
    if let Some(owner) = owners.get(&path) {
        if owner != &window_label && app.get_webview_window(owner).is_some() {
            return Some(owner.clone());
        }
    }
    owners.insert(path, window_label);
    None
}

#[tauri::command]
fn release_document(registry: tauri::State<WindowRegistry>, path: String, window_label: String) {
    let mut owners = registry.owners.lock().unwrap();
    if owners.get(&path) == Some(&window_label) {
        owners.remove(&path);
    }
}

#[tauri::command]
fn focus_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| "La ventana ya no existe".to_string())?;
    window
        .show()
        .and_then(|_| window.unminimize())
        .and_then(|_| window.set_focus())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn gather_windows(app: tauri::AppHandle, target: String) -> Result<(), String> {
    if app.get_webview_window(&target).is_none() {
        return Err("La ventana de destino ya no existe".into());
    }
    for label in app
        .webview_windows()
        .keys()
        .filter(|label| *label != &target)
    {
        let _ = app.emit_to(label, "gather-tabs", target.clone());
    }
    focus_window(app, target)
}

#[tauri::command]
fn window_at_point(app: tauri::AppHandle, x: f64, y: f64, exclude: String) -> Option<String> {
    for (label, window) in app.webview_windows() {
        if label == exclude || !window.is_visible().unwrap_or(false) {
            continue;
        }
        let scale = window.scale_factor().ok()?;
        let position = window.outer_position().ok()?;
        let size = window.outer_size().ok()?;
        let left = position.x as f64 / scale;
        let top = position.y as f64 / scale;
        let right = left + size.width as f64 / scale;
        let bottom = top + size.height as f64 / scale;
        if x >= left && x <= right && y >= top && y <= bottom {
            return Some(label);
        }
    }
    None
}

// I/O byte-fiel: el archivo se guarda tal cual lo escribió el usuario.
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    read_text_file(path)
}

// Guardado atómico: escribe a un temporal y lo renombra sobre el destino
// (rename es atómico en el mismo volumen). Devuelve el mtime resultante en ms.
#[tauri::command]
fn write_file(path: String, contents: String) -> Result<u64, String> {
    write_text_file(path, contents)
}

// mtime en ms desde epoch, para detectar cambios externos antes de sobrescribir.
#[tauri::command]
fn stat(path: String) -> Option<u64> {
    mtime_ms(&path).ok()
}

#[tauri::command]
fn allow_preview_asset(app: tauri::AppHandle, path: String) -> Result<String, String> {
    const MEDIA_EXTENSIONS: &[&str] = &[
        "apng", "avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp", "aac", "flac", "m4a",
        "mp3", "oga", "ogg", "wav", "m4v", "mov", "mp4", "ogv", "webm",
    ];
    let canonical = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
    let extension = canonical
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "El recurso local no tiene una extensión multimedia".to_string())?;
    if !MEDIA_EXTENSIONS.contains(&extension.as_str()) {
        return Err("El recurso local no es un formato multimedia permitido".into());
    }
    app.asset_protocol_scope()
        .allow_file(&canonical)
        .map_err(|e| e.to_string())?;
    Ok(canonical.to_string_lossy().into_owned())
}

#[tauri::command]
fn take_opened_files(state: tauri::State<Pending>) -> Vec<String> {
    std::mem::take(&mut *state.files.lock().unwrap())
}

#[tauri::command]
fn take_new_document(state: tauri::State<Pending>) -> bool {
    state.new_document.swap(false, Ordering::SeqCst)
}

// Exportar a PDF. En macOS Tauri sustituye `window.print()` por una impresión
// nativa cuyo NSPrintInfo lleva márgenes cero, y WebKit pagina con el área
// imprimible del sistema (ignora `@page`): el texto llegaba al borde de la hoja.
// Aquí se imprime igual que wry, pero con márgenes reales. En otras plataformas
// devuelve error y el frontend usa `window.print()`.
#[tauri::command]
fn print_with_margins(webview: tauri::Webview) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        webview
            .with_webview(|w| unsafe {
                use objc2::runtime::{AnyObject, Sel};
                use objc2::{class, msg_send};
                let wk = w.inner() as *mut AnyObject;
                let info: *mut AnyObject = msg_send![class!(NSPrintInfo), sharedPrintInfo];
                // 20 mm arriba/abajo y 18 mm a los lados, en puntos (1 mm = 72/25.4 pt).
                let (v, h): (f64, f64) = (20.0 * 72.0 / 25.4, 18.0 * 72.0 / 25.4);
                let _: () = msg_send![info, setTopMargin: v];
                let _: () = msg_send![info, setBottomMargin: v];
                let _: () = msg_send![info, setLeftMargin: h];
                let _: () = msg_send![info, setRightMargin: h];
                let op: *mut AnyObject = msg_send![wk, printOperationWithPrintInfo: info];
                let _: () = msg_send![op, setCanSpawnSeparateThread: true];
                let window: *mut AnyObject = msg_send![wk, window];
                let _: () = msg_send![op, runOperationModalForWindow: window, delegate: std::ptr::null_mut::<AnyObject>(), didRunSelector: None::<Sel>, contextInfo: std::ptr::null_mut::<std::ffi::c_void>()];
            })
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = webview;
        Err("sin impresión nativa en esta plataforma".into())
    }
}

// Menú nativo. Los ítems propios emiten su id al frontend (evento "menu"); los
// predefinidos (deshacer/copiar/pegar, salir…) los maneja el sistema.
fn build_menu(app: &tauri::App) -> tauri::Result<()> {
    let item = |id: &str, label: &str, accel: Option<&str>| {
        let mut b = MenuItemBuilder::with_id(id, label);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };

    let prefs_mermaid = item(
        "prefs_mermaid",
        "Configuración de diseño…",
        Some("CmdOrCtrl+,"),
    )?;
    let about = item("about", "Acerca de Luca", None)?;

    let app_menu = SubmenuBuilder::new(app, "Luca")
        .item(&about)
        .separator()
        .item(&prefs_mermaid)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let archivo = SubmenuBuilder::new(app, "Archivo")
        .item(&item("new", "Nuevo", Some("CmdOrCtrl+N"))?)
        .item(&item("open", "Abrir…", Some("CmdOrCtrl+O"))?)
        .separator()
        .item(&item("save", "Guardar", Some("CmdOrCtrl+S"))?)
        .item(&item(
            "save_as",
            "Guardar como…",
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&item("export_pdf", "Exportar (PDF)…", Some("CmdOrCtrl+E"))?)
        .separator()
        .item(&prefs_mermaid)
        .separator()
        .item(&item("close_tab", "Cerrar pestaña", Some("CmdOrCtrl+W"))?)
        .build()?;

    let edicion = SubmenuBuilder::new(app, "Edición")
        .undo()
        .redo()
        .separator()
        .item(&item(
            "select_next_occurrence",
            "Seleccionar siguiente aparición",
            Some("CmdOrCtrl+D"),
        )?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let vista = SubmenuBuilder::new(app, "Vista")
        .item(&item(
            "mode_source",
            "Código Markdown",
            Some("CmdOrCtrl+1"),
        )?)
        .item(&item("mode_split", "Vista dividida", Some("CmdOrCtrl+2"))?)
        .item(&item(
            "mode_rendered",
            "Texto renderizado",
            Some("CmdOrCtrl+3"),
        )?)
        .separator()
        .item(&item("zen", "Modo zen", Some("CmdOrCtrl+Shift+Z"))?)
        .build()?;

    let ventana = SubmenuBuilder::new(app, "Ventana")
        .item(&item(
            "new_window",
            "Nueva ventana",
            Some("CmdOrCtrl+Shift+N"),
        )?)
        .item(&item(
            "detach_tab",
            "Mover pestaña a nueva ventana",
            Some("CmdOrCtrl+Shift+M"),
        )?)
        .item(&item(
            "move_tab_left",
            "Mover pestaña a la izquierda",
            Some("Alt+Shift+Left"),
        )?)
        .item(&item(
            "move_tab_right",
            "Mover pestaña a la derecha",
            Some("Alt+Shift+Right"),
        )?)
        .separator()
        .item(&item("gather_windows", "Reunir todas las ventanas", None)?)
        .separator()
        .minimize()
        .build()?;

    let ayuda = SubmenuBuilder::new(app, "Ayuda")
        .item(&item(
            "command_palette",
            "Paleta de comandos…",
            Some("CmdOrCtrl+Shift+P"),
        )?)
        .item(&item("shortcuts", "Atajos de teclado", Some("F1"))?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &archivo, &edicion, &vista, &ventana, &ayuda])
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

fn main() {
    let startup_args: Vec<OsString> = std::env::args_os().collect();
    match file_argument::requested_information(startup_args.clone()) {
        Some("help") => {
            println!(
                "Luca {}\n\nUso: luca [--new] [--] [archivo …]\n\n  Admite .md, .markdown, .wiki y .wikitext.\n\n  --new          crea una pestaña vacía\n  -h, --help     muestra esta ayuda\n  -V, --version  muestra la versión",
                env!("CARGO_PKG_VERSION")
            );
            return;
        }
        Some("version") => {
            println!("Luca {}", env!("CARGO_PKG_VERSION"));
            return;
        }
        _ => {}
    }
    let startup_cwd = std::env::current_dir().unwrap_or_default();
    let startup_request = file_argument::parse_launch_arguments(startup_args, &startup_cwd);

    tauri::Builder::default()
        .plugin(
            tauri::plugin::Builder::<_, ()>::new("navigation-guard")
                .on_navigation(|_, url| {
                    navigation_allowed(url.scheme(), url.host_str(), cfg!(debug_assertions))
                })
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let request = file_argument::parse_launch_arguments(args, std::path::Path::new(&cwd));
            if let Some(pending) = app.try_state::<Pending>() {
                pending.files.lock().unwrap().extend(request.files);
                if request.new_document {
                    pending.new_document.store(true, Ordering::SeqCst);
                }
            }
            let _ = app.emit("launch-request", ());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Pending {
            files: Mutex::new(Vec::new()),
            new_document: AtomicBool::new(false),
        })
        .manage(WindowRegistry::default())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            stat,
            allow_preview_asset,
            take_opened_files,
            take_new_document,
            print_with_margins,
            parse_wikitext,
            create_editor_window,
            transfer_tab,
            take_transferred_tabs,
            claim_document,
            release_document,
            focus_window,
            gather_windows,
            window_at_point
        ])
        .setup(move |app| {
            *app.state::<Pending>().files.lock().unwrap() = startup_request.files.clone();
            app.state::<Pending>()
                .new_document
                .store(startup_request.new_document, Ordering::SeqCst);
            build_menu(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let focused = app
                .webview_windows()
                .into_values()
                .find(|window| window.is_focused().unwrap_or(false))
                .or_else(|| app.get_webview_window("main"));
            if let Some(w) = focused {
                let _ = w.emit("menu", event.id().0.clone());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running luca")
        .run(move |app, event| {
            // macOS entrega los archivos de "Abrir con…" como RunEvent::Opened.
            #[cfg(target_os = "macos")]
            {
                if let tauri::RunEvent::Opened { urls } = event {
                    let paths = urls
                        .iter()
                        .filter_map(|u| u.to_file_path().ok())
                        .map(|p| p.to_string_lossy().into_owned())
                        .collect::<Vec<_>>();
                    if !paths.is_empty() {
                        app.state::<Pending>()
                            .files
                            .lock()
                            .unwrap()
                            .extend(paths.clone());
                        let _ = app.emit("launch-request", ());
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, event);
            }
        });
}
