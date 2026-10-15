//! Updates of the installed app (tauri-plugin-updater). The UI asks `update_check` at start and
//! every few hours; when the feed (`plugins.updater` in tauri.conf.json, the release's
//! `latest.json`) names a newer version, `update_install` downloads it, checks its signature
//! against the public key of the config, installs it and starts the new version. Windows: the
//! NSIS setup runs in passive mode (a progress bar, no questions) and starts the app again
//! itself; macOS replaces the .app, Linux the AppImage or, for a .deb install, the package.
//!
//! Debug builds (development, end-to-end tests) never check: a release would replace them.

use std::sync::Mutex;
use std::sync::atomic::Ordering;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::utils::config::BundleType;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::{CmdError, ExitConfirmed};

/// The plugin with its configuration from tauri.conf.json. It fetches nothing by itself.
pub fn plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R, tauri_plugin_updater::Config> {
    tauri_plugin_updater::Builder::new().build()
}

/// The update found by the last check, installed by `update_install`.
#[derive(Default)]
pub struct Pending(Mutex<Option<Update>>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    /// The installed copy cannot install this file itself (a .deb install offered the AppImage):
    /// the UI points to the download page instead.
    manual: bool,
}

/// Download progress for the UI: bytes so far, and the size when the server sent it.
#[derive(Clone, Serialize)]
pub struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

fn enabled() -> bool {
    !cfg!(debug_assertions)
}

/// Whether a copy installed as `bundle` can install the file at `url`. A package (.deb, .rpm) is
/// updated with a package of its kind only; everything else takes what its feed entry names.
fn installs_itself(url: &str, bundle: Option<BundleType>) -> bool {
    let url = url.to_ascii_lowercase();
    match bundle {
        Some(BundleType::Deb) => url.ends_with(".deb"),
        Some(BundleType::Rpm) => url.ends_with(".rpm"),
        _ => true,
    }
}

fn failed(e: impl ToString) -> CmdError {
    CmdError::io(None, e)
}

/// Whether this build looks for updates at all (release builds only).
#[tauri::command]
pub fn update_enabled() -> bool {
    enabled()
}

/// Asks the feed for a newer version; `None` when there is none (or in a debug build).
#[tauri::command]
pub async fn update_check(app: AppHandle, pending: State<'_, Pending>) -> Result<Option<UpdateInfo>, CmdError> {
    if !enabled() {
        return Ok(None);
    }
    let update = app.updater().map_err(failed)?.check().await.map_err(failed)?;
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        manual: !installs_itself(u.download_url.as_str(), tauri::utils::platform::bundle_type()),
    });
    *pending.0.lock().map_err(failed)? = update;
    Ok(info)
}

/// Downloads and installs the update of the last check, then restarts. The UI has dealt with
/// unsaved changes before: the restart does not ask again.
#[tauri::command]
pub async fn update_install(
    app: AppHandle,
    pending: State<'_, Pending>,
    exit: State<'_, ExitConfirmed>,
    on_progress: Channel<Progress>,
) -> Result<(), CmdError> {
    let update = pending.0.lock().map_err(failed)?.take().ok_or_else(|| failed("no update to install"))?;
    let mut downloaded = 0u64;
    let bytes = match update
        .download(
            |chunk, total| {
                downloaded += chunk as u64;
                let _ = on_progress.send(Progress { downloaded, total });
            },
            || {},
        )
        .await
    {
        Ok(bytes) => bytes,
        Err(e) => {
            // A failed download may be tried again from the notice.
            if let Ok(mut p) = pending.0.lock() {
                *p = Some(update);
            }
            return Err(failed(e));
        }
    };
    // Windows ends the process inside `install` (the setup replaces the running program).
    exit.0.store(true, Ordering::SeqCst);
    if let Err(e) = update.install(bytes) {
        exit.0.store(false, Ordering::SeqCst);
        return Err(failed(e));
    }
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packages_install_only_packages_of_their_kind() {
        let base = "https://github.com/MouseWerk/kitchenplaner/releases/download/v0.2.1/Kitchenplaner_0.2.1";
        assert!(installs_itself(&format!("{base}_amd64.deb"), Some(BundleType::Deb)));
        assert!(!installs_itself(&format!("{base}_amd64.AppImage"), Some(BundleType::Deb)));
        assert!(!installs_itself(&format!("{base}_amd64.AppImage"), Some(BundleType::Rpm)));
        assert!(installs_itself(&format!("{base}_amd64.AppImage"), Some(BundleType::AppImage)));
        assert!(installs_itself(&format!("{base}_x64-setup.exe"), Some(BundleType::Nsis)));
        assert!(installs_itself(&format!("{base}_universal.app.tar.gz"), Some(BundleType::App)));
        assert!(installs_itself(&format!("{base}_x64-setup.exe"), None));
    }

    #[test]
    fn debug_builds_never_look_for_updates() {
        assert_eq!(update_enabled(), !cfg!(debug_assertions));
    }
}
