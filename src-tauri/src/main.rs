#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::ffi::OsString;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

// Analiza tanto aperturas iniciales como argumentos reenviados por la segunda
// instancia. macOS además entrega asociaciones mediante RunEvent::Opened.
mod file_argument;

// Aperturas pendientes en frío: el sistema puede entregar varios archivos
// antes de que el frontend registre los listeners.
struct Pending {
    files: Mutex<Vec<String>>,
    new_document: AtomicBool,
}

// I/O byte-fiel: el archivo se guarda tal cual lo escribió el usuario.
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

// Guardado atómico: escribe a un temporal y lo renombra sobre el destino
// (rename es atómico en el mismo volumen). Devuelve el mtime resultante en ms.
#[tauri::command]
fn write_file(path: String, contents: String) -> Result<u64, String> {
    let tmp = format!("{path}.luca-tmp");
    std::fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    mtime_ms(&path)
}

// mtime en ms desde epoch, para detectar cambios externos antes de sobrescribir.
#[tauri::command]
fn stat(path: String) -> Option<u64> {
    mtime_ms(&path).ok()
}

fn mtime_ms(path: &str) -> Result<u64, String> {
    let modified = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .map_err(|e| e.to_string())?;
    modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .map_err(|e| e.to_string())
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
        .minimize()
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &archivo, &edicion, &vista, &ventana])
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

fn main() {
    let startup_args: Vec<OsString> = std::env::args_os().collect();
    match file_argument::requested_information(startup_args.clone()) {
        Some("help") => {
            println!(
                "Luca {}\n\nUso: luca [--new] [--] [archivo.md …]\n\n  --new          crea una pestaña vacía\n  -h, --help     muestra esta ayuda\n  -V, --version  muestra la versión",
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
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            stat,
            take_opened_files,
            take_new_document,
            print_with_margins
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
            if let Some(w) = app.get_webview_window("main") {
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
