#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

// Archivo pendiente de apertura en frío (Finder / "Abrir con…" de Vera lanzan
// la app antes de que el frontend registre el listener).
struct Pending(Mutex<Option<String>>);

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
fn take_opened_file(state: tauri::State<Pending>) -> Option<String> {
    state.0.lock().unwrap().take()
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

    let app_menu = SubmenuBuilder::new(app, "Luca")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let prefs_mermaid = item("prefs_mermaid", "Tokens y tema de Mermaid…", None)?;
    let preferencias = SubmenuBuilder::new(app, "Preferencias").item(&prefs_mermaid).build()?;
    let archivo = SubmenuBuilder::new(app, "Archivo")
        .item(&item("new", "Nuevo", Some("CmdOrCtrl+N"))?)
        .item(&item("open", "Abrir…", Some("CmdOrCtrl+O"))?)
        .separator()
        .item(&item("save", "Guardar", Some("CmdOrCtrl+S"))?)
        .item(&item("save_as", "Guardar como…", Some("CmdOrCtrl+Shift+S"))?)
        .separator()
        .item(&item("export_pdf", "Exportar (PDF)…", Some("CmdOrCtrl+E"))?)
        .separator()
        .item(&preferencias)
        .separator()
        .item(&item("close_tab", "Cerrar pestaña", Some("CmdOrCtrl+W"))?)
        .build()?;

    let edicion = SubmenuBuilder::new(app, "Edición")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let vista = SubmenuBuilder::new(app, "Vista")
        .item(&item("mode_source", "Código Markdown", Some("CmdOrCtrl+1"))?)
        .item(&item("mode_split", "Vista dividida", Some("CmdOrCtrl+2"))?)
        .item(&item("mode_rendered", "Texto renderizado", Some("CmdOrCtrl+3"))?)
        .separator()
        .item(&item("zen", "Modo zen", Some("CmdOrCtrl+Shift+Z"))?)
        .build()?;

    let ventana = SubmenuBuilder::new(app, "Ventana").minimize().build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &archivo, &edicion, &vista, &ventana])
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Pending(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![read_file, write_file, stat, take_opened_file])
        .setup(|app| {
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
                    if let Some(path) = urls
                        .iter()
                        .find_map(|u| u.to_file_path().ok())
                        .map(|p| p.to_string_lossy().into_owned())
                    {
                        *app.state::<Pending>().0.lock().unwrap() = Some(path.clone());
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.emit("open-file", path);
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
