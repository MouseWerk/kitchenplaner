//! The autosave commands: a thin layer over `kitchen_core::autosave` (see there and
//! docs/ARCHITECTURE.md). The session starts with the first command, which the UI sends at start
//! (`autosave_list`), and holds its lock until the process ends.

use crate::{CmdError, data_dir};
use kitchen_core::autosave::{self, Recoverable, Restored, Session};
use std::sync::Mutex;
use tauri::{AppHandle, State};

/// This app's autosave session, started on first use.
#[derive(Default)]
pub struct AutosaveState(Mutex<Option<Session>>);

fn with_session<T>(
    app: &AppHandle,
    state: &AutosaveState,
    f: impl FnOnce(&Session) -> Result<T, CmdError>,
) -> Result<T, CmdError> {
    let mut guard = state.0.lock().map_err(|e| CmdError::io(None, e))?;
    if guard.is_none() {
        *guard = Some(Session::start(&data_dir(app)?.join(autosave::DIR))?);
    }
    f(guard.as_ref().expect("started above"))
}

/// Keeps the project text as this session's backup. `path` is the file it belongs to (null for a
/// project never saved), `name` the project name; the shell adds the time and its version.
#[tauri::command]
pub fn autosave_write(
    app: AppHandle,
    state: State<'_, AutosaveState>,
    project: String,
    path: Option<String>,
    name: String,
) -> Result<(), CmdError> {
    let version = app.package_info().version.to_string();
    with_session(&app, &state, |s| Ok(s.write(&project, path.as_deref(), &name, &version)?))
}

#[tauri::command]
pub fn autosave_clear(app: AppHandle, state: State<'_, AutosaveState>) -> Result<(), CmdError> {
    with_session(&app, &state, |s| Ok(s.clear()?))
}

/// Backups of earlier sessions that ended without saving, newest first.
#[tauri::command]
pub fn autosave_list(app: AppHandle, state: State<'_, AutosaveState>) -> Result<Vec<Recoverable>, CmdError> {
    with_session(&app, &state, |s| Ok(s.recoverable()))
}

#[tauri::command]
pub fn autosave_restore(app: AppHandle, state: State<'_, AutosaveState>, id: String) -> Result<Restored, CmdError> {
    with_session(&app, &state, |s| Ok(s.restore(&id)?))
}

#[tauri::command]
pub fn autosave_discard(app: AppHandle, state: State<'_, AutosaveState>, id: String) -> Result<(), CmdError> {
    with_session(&app, &state, |s| Ok(s.discard(&id)?))
}
