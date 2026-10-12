//! The desktop shell: one window with the UI, and the few commands it needs for file IO. The
//! logic lives in kitchen-core; this file only adapts it to Tauri.

use base64::Engine;
use kitchen_core::{ErrorKind, FileError, recent};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};

/// Event sent to the UI when the system asks the running app to open a project (macOS: a
/// double-click on a .kplan file while the app is open). Payload: the path as a string.
#[cfg(target_os = "macos")]
const OPEN_FILE_EVENT: &str = "open-file";

/// The error every command returns, serialised as `{ "kind": "tooLarge" | "notUtf8" |
/// "notProject" | "io", "message": "..." }`. The UI shows its own text per kind.
#[derive(Debug, Serialize)]
pub struct CmdError {
    kind: ErrorKind,
    message: String,
}

impl From<FileError> for CmdError {
    fn from(e: FileError) -> Self {
        CmdError { kind: e.kind(), message: e.to_string() }
    }
}

impl CmdError {
    fn io(message: impl Into<String>) -> Self {
        CmdError { kind: ErrorKind::Io, message: message.into() }
    }
}

/// The project the app was started with (file association, `kitchenplaner plan.kplan`).
struct StartupFile(Mutex<Option<String>>);

#[tauri::command]
fn read_project(path: String) -> Result<String, CmdError> {
    Ok(kitchen_core::read_project(path)?)
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), CmdError> {
    Ok(kitchen_core::write_atomic(path, contents.as_bytes())?)
}

/// Binary exports (PNG) arrive base64-encoded: the IPC would otherwise send them as a JSON
/// array of numbers, several times larger.
#[tauri::command]
fn write_binary_file(path: String, data: String) -> Result<(), CmdError> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|e| CmdError::io(format!("Die Daten für „{path}“ sind nicht lesbar: {e}")))?;
    Ok(kitchen_core::write_atomic(path, &bytes)?)
}

#[tauri::command]
fn recent_files(app: tauri::AppHandle) -> Result<Vec<String>, CmdError> {
    Ok(recent::list(&data_dir(&app)?))
}

#[tauri::command]
fn add_recent_file(app: tauri::AppHandle, path: String) -> Result<(), CmdError> {
    Ok(recent::add(&data_dir(&app)?, &path)?)
}

/// The project file to open at start, if any. Not consumed: the UI may ask again after a reload
/// (and React's development mode runs effects twice).
#[tauri::command]
fn startup_file(state: State<'_, StartupFile>) -> Option<String> {
    state.0.lock().ok().and_then(|f| f.clone())
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, CmdError> {
    app.path().app_data_dir().map_err(|e| CmdError::io(format!("Der Datenordner der App ist nicht verfügbar: {e}")))
}

/// The first argument that names an existing file. Windows and Linux pass the file of a
/// double-click as an argument; flags (from a shortcut or a debugger) are skipped.
fn file_from_args(args: impl IntoIterator<Item = String>) -> Option<String> {
    args.into_iter()
        .filter(|a| !a.starts_with('-'))
        .map(PathBuf::from)
        .find(|p| p.is_file())
        .map(|p| absolute(&p).to_string_lossy().into_owned())
}

fn absolute(p: &Path) -> PathBuf {
    std::path::absolute(p).unwrap_or_else(|_| p.to_path_buf())
}

pub fn run() {
    let startup = file_from_args(std::env::args().skip(1));
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(StartupFile(Mutex::new(startup)))
        .invoke_handler(tauri::generate_handler![
            read_project,
            write_text_file,
            write_binary_file,
            recent_files,
            add_recent_file,
            startup_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building the Kitchenplaner window");

    app.run(|_app, _event| {
        // macOS hands files to the app as an event, not as arguments (also at start).
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &_event {
            use tauri::Emitter;
            let Some(path) = urls.iter().find_map(|u| u.to_file_path().ok()) else { return };
            let path = path.to_string_lossy().into_owned();
            if let Some(state) = _app.try_state::<StartupFile>()
                && let Ok(mut f) = state.0.lock()
            {
                *f = Some(path.clone());
            }
            let _ = _app.emit(OPEN_FILE_EVENT, path);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_file_skips_flags_and_missing_paths() {
        let dir = std::env::temp_dir().join(format!("kitchenplaner-args-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("Küche Ü.kplan");
        std::fs::write(&file, "{}").unwrap();
        let args = vec![
            "--flag".to_owned(),
            dir.join("fehlt.kplan").to_string_lossy().into_owned(),
            file.to_string_lossy().into_owned(),
        ];
        assert_eq!(file_from_args(args), Some(file.to_string_lossy().into_owned()));
        assert_eq!(file_from_args(vec![dir.to_string_lossy().into_owned()]), None);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn error_shape_for_the_ui() {
        let e = CmdError::from(FileError::NotUtf8 { path: "a.kplan".into() });
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["kind"], "notUtf8");
        assert!(v["message"].is_string());
    }
}
