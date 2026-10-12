//! The desktop shell: one window with the UI, and the few commands it needs for file IO. The
//! logic lives in kitchen-core; this file only adapts it to Tauri.

use base64::Engine;
use kitchen_core::{
    BINARY_FILE_EXTENSIONS, ErrorKind, FileError, PROJECT_EXTENSIONS, TEXT_FILE_EXTENSIONS, check_path, file_name_of,
    recent,
};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, State};

/// Event sent to the UI when the system asks the running app to open a project (macOS: a
/// double-click on a .kplan file while the app is open). Payload: the path as a string.
#[cfg(target_os = "macos")]
const OPEN_FILE_EVENT: &str = "open-file";

/// Event sent to the main window when the user asks to quit the whole app (macOS: Cmd+Q, the
/// app menu). The UI asks about unsaved changes and then calls `confirm_exit`. No payload.
const EXIT_REQUESTED_EVENT: &str = "exit-requested";

const MAIN_WINDOW: &str = "main";

/// Menu id of our own Quit item, which replaces the predefined one on macOS.
const QUIT_MENU_ID: &str = "quit";

/// The error every command returns, serialised as `{ "kind": "...", "path": "<file name>" | null,
/// "detail": "<OS text>" | null }` (kinds: see `kitchen_core::ErrorKind`). The UI builds its text
/// per kind in the user's language, so nothing German reaches the English UI.
#[derive(Debug, Serialize)]
pub struct CmdError {
    kind: ErrorKind,
    path: Option<String>,
    detail: Option<String>,
}

impl From<FileError> for CmdError {
    fn from(e: FileError) -> Self {
        CmdError { kind: e.kind(), path: Some(e.file_name()), detail: e.detail() }
    }
}

impl CmdError {
    fn io(path: Option<&str>, detail: impl ToString) -> Self {
        CmdError { kind: ErrorKind::Io, path: path.map(file_name_of), detail: Some(detail.to_string()) }
    }
}

/// The project the app was started with (file association, `kitchenplaner plan.kplan`).
struct StartupFile(Mutex<Option<String>>);

/// Set once the UI has dealt with unsaved changes and asked to quit; later exit requests pass.
#[derive(Default)]
struct ExitConfirmed(AtomicBool);

#[tauri::command]
fn read_project(path: String) -> Result<String, CmdError> {
    Ok(kitchen_core::read_project(path)?)
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), CmdError> {
    check_path(&path, TEXT_FILE_EXTENSIONS)?;
    Ok(kitchen_core::write_atomic(path, contents.as_bytes())?)
}

/// Binary exports (PNG) arrive base64-encoded: the IPC would otherwise send them as a JSON
/// array of numbers, several times larger.
#[tauri::command]
fn write_binary_file(path: String, data: String) -> Result<(), CmdError> {
    check_path(&path, BINARY_FILE_EXTENSIONS)?;
    let bytes =
        base64::engine::general_purpose::STANDARD.decode(data.as_bytes()).map_err(|e| CmdError::io(Some(&path), e))?;
    Ok(kitchen_core::write_atomic(path, &bytes)?)
}

#[tauri::command]
fn recent_files(app: tauri::AppHandle) -> Result<Vec<String>, CmdError> {
    Ok(recent::list(&data_dir(&app)?))
}

/// Only projects go into the list: it is shown on the start screen and read back with
/// `read_project`, which would refuse anything else anyway.
#[tauri::command]
fn add_recent_file(app: tauri::AppHandle, path: String) -> Result<(), CmdError> {
    check_path(&path, PROJECT_EXTENSIONS)?;
    Ok(recent::add(&data_dir(&app)?, &path)?)
}

/// The project file to open at start, if any. Not consumed: the UI may ask again after a reload
/// (and React's development mode runs effects twice).
#[tauri::command]
fn startup_file(state: State<'_, StartupFile>) -> Option<String> {
    state.0.lock().ok().and_then(|f| f.clone())
}

/// The UI's answer to `exit-requested` once unsaved changes are saved or discarded.
#[tauri::command]
fn confirm_exit(app: tauri::AppHandle, confirmed: State<'_, ExitConfirmed>) {
    confirmed.0.store(true, Ordering::SeqCst);
    app.exit(0);
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, CmdError> {
    app.path().app_data_dir().map_err(|e| CmdError::io(None, e))
}

/// What to do with a request to end the app.
#[derive(Debug, PartialEq, Eq)]
enum ExitDecision {
    /// Let it end.
    Allow,
    /// Keep running and let the UI ask about unsaved changes first.
    AskUi,
}

/// `code` is `Some` when the app itself called `exit` (only `confirm_exit` does, after the UI
/// asked) and `None` for a request by the user or the system. A `None` with no window left is the
/// UI's own `destroy()` after its close dialog: holding the app then would leave a process without
/// a window, so only a request while the window is still open goes to the UI.
fn decide_exit(code: Option<i32>, confirmed: bool, window_open: bool) -> ExitDecision {
    if confirmed || code.is_some() || !window_open { ExitDecision::Allow } else { ExitDecision::AskUi }
}

/// Hands a quit request to the UI; false when it cannot be reached (then the app should end
/// rather than ignore the user).
fn ask_ui_to_exit<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> bool {
    app.get_webview_window(MAIN_WINDOW).is_some_and(|w| w.emit(EXIT_REQUESTED_EVENT, ()).is_ok())
}

fn quit_requested<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let confirmed = app.state::<ExitConfirmed>().0.load(Ordering::SeqCst);
    let window_open = app.get_webview_window(MAIN_WINDOW).is_some();
    if decide_exit(None, confirmed, window_open) == ExitDecision::Allow || !ask_ui_to_exit(app) {
        app.exit(0);
    }
}

/// Tauri's default macOS menu with our own Quit item. The predefined Quit sends `terminate:`
/// straight to AppKit, which ends the process without an `ExitRequested` event, so Cmd+Q would
/// skip the unsaved-changes question. Built on every OS so it is type-checked everywhere; only
/// macOS installs it (Windows and Linux have no app menu).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
    let pkg = app.package_info();
    let config = app.config();
    let about = AboutMetadata {
        name: Some(pkg.name.clone()),
        version: Some(pkg.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config.bundle.publisher.clone().map(|p| vec![p]),
        ..Default::default()
    };
    let quit = MenuItem::with_id(app, QUIT_MENU_ID, format!("Quit {}", pkg.name), true, Some("CmdOrCtrl+Q"))?;
    Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                pkg.name.clone(),
                true,
                &[
                    &PredefinedMenuItem::about(app, None, Some(about))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &quit,
                ],
            )?,
            &Submenu::with_items(app, "File", true, &[&PredefinedMenuItem::close_window(app, None)?])?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            &Submenu::with_items(app, "View", true, &[&PredefinedMenuItem::fullscreen(app, None)?])?,
            &Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?,
        ],
    )
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
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(StartupFile(Mutex::new(startup)))
        .manage(ExitConfirmed::default())
        .on_menu_event(|app, event| {
            if event.id() == QUIT_MENU_ID {
                quit_requested(app);
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_project,
            write_text_file,
            write_binary_file,
            recent_files,
            add_recent_file,
            startup_file,
            confirm_exit,
        ]);
    #[cfg(target_os = "macos")]
    let builder = builder.menu(app_menu);
    let app = builder.build(tauri::generate_context!()).expect("error while building the Kitchenplaner window");

    app.run(|app, event| match event {
        tauri::RunEvent::ExitRequested { code, api, .. } => {
            let confirmed = app.state::<ExitConfirmed>().0.load(Ordering::SeqCst);
            let window_open = app.get_webview_window(MAIN_WINDOW).is_some();
            if decide_exit(code, confirmed, window_open) == ExitDecision::AskUi && ask_ui_to_exit(app) {
                api.prevent_exit();
            }
        }
        // macOS hands files to the app as an event, not as arguments (also at start).
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Opened { urls } => {
            let Some(path) = urls.iter().find_map(|u| u.to_file_path().ok()) else { return };
            let path = path.to_string_lossy().into_owned();
            if let Some(state) = app.try_state::<StartupFile>()
                && let Ok(mut f) = state.0.lock()
            {
                *f = Some(path.clone());
            }
            let _ = app.emit(OPEN_FILE_EVENT, path);
        }
        _ => {}
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
        let e = CmdError::from(FileError::NotUtf8 { path: "/pläne/a.kplan".into() });
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v, serde_json::json!({ "kind": "notUtf8", "path": "a.kplan", "detail": null }));

        let e = CmdError::io(None, "kein Datenordner");
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v, serde_json::json!({ "kind": "io", "path": null, "detail": "kein Datenordner" }));
    }

    #[test]
    fn commands_refuse_paths_outside_their_file_types() {
        let exe = std::env::temp_dir().join("kitchenplaner-test.exe").to_string_lossy().into_owned();
        let e = write_text_file(exe.clone(), "x".into()).unwrap_err();
        assert_eq!(e.kind, ErrorKind::BadExtension);
        assert_eq!(e.path.as_deref(), Some("kitchenplaner-test.exe"));
        assert!(!Path::new(&exe).exists());
        assert_eq!(write_binary_file(exe, String::new()).unwrap_err().kind, ErrorKind::BadExtension);
        assert_eq!(write_text_file("plan.kplan".into(), "x".into()).unwrap_err().kind, ErrorKind::BadPath);
        assert_eq!(read_project("plan.kplan".into()).unwrap_err().kind, ErrorKind::BadPath);
    }

    #[test]
    fn exit_asks_the_ui_only_while_the_window_is_open_and_unconfirmed() {
        use ExitDecision::*;
        // Cmd+Q or a system request with the window open: the UI asks first.
        assert_eq!(decide_exit(None, false, true), AskUi);
        // After confirm_exit: its own app.exit(0), and any later request, pass.
        assert_eq!(decide_exit(Some(0), true, true), Allow);
        assert_eq!(decide_exit(None, true, true), Allow);
        // The UI destroyed the last window after its close dialog: never hold a windowless app.
        assert_eq!(decide_exit(None, false, false), Allow);
        // A programmatic exit (restart) is not a user request.
        assert_eq!(decide_exit(Some(0), false, true), Allow);
    }
}
