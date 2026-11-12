//! Updates of the installed app (tauri-plugin-updater). The UI asks `update_check` at start and
//! every few hours; when the feed (`plugins.updater` in tauri.conf.json, the release's
//! `latest.json`) names a newer version, `update_download` downloads it and checks its signature
//! against the public key of the config, and `update_install` installs it and starts the new
//! version. Two steps, so the UI can deal with changes made while the download ran before the
//! restart. Windows: the NSIS setup runs in passive mode (a progress bar, no questions) and starts
//! the app again itself; macOS replaces the .app, Linux the AppImage or, for a .deb install, the
//! package.
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

/// The update found by the last check, and once `update_download` has run, its verified file.
#[derive(Default)]
pub struct Pending {
    found: Mutex<Option<Update>>,
    downloaded: Mutex<Option<(Update, Vec<u8>)>>,
}

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
    // A file downloaded for an earlier answer must not be installed in place of this one.
    *pending.downloaded.lock().map_err(failed)? = None;
    *pending.found.lock().map_err(failed)? = update;
    Ok(info)
}

/// Downloads the update of the last check and verifies its signature; `update_install` installs it.
#[tauri::command]
pub async fn update_download(pending: State<'_, Pending>, on_progress: Channel<Progress>) -> Result<(), CmdError> {
    let update = pending.found.lock().map_err(failed)?.take().ok_or_else(|| failed("no update to download"))?;
    let mut downloaded = 0u64;
    let result = update
        .download(
            |chunk, total| {
                downloaded += chunk as u64;
                let _ = on_progress.send(Progress { downloaded, total });
            },
            || {},
        )
        .await;
    match result {
        Ok(bytes) => {
            *pending.downloaded.lock().map_err(failed)? = Some((update, bytes));
            Ok(())
        }
        Err(e) => {
            // A failed download may be tried again from the notice.
            if let Ok(mut p) = pending.found.lock() {
                *p = Some(update);
            }
            Err(failed(e))
        }
    }
}

/// Installs the downloaded update, then restarts. The UI has dealt with unsaved changes before:
/// the restart does not ask again.
#[tauri::command]
pub async fn update_install(
    app: AppHandle,
    pending: State<'_, Pending>,
    exit: State<'_, ExitConfirmed>,
) -> Result<(), CmdError> {
    let (update, bytes) =
        pending.downloaded.lock().map_err(failed)?.take().ok_or_else(|| failed("no update downloaded"))?;
    // Windows ends the process inside `install` (the setup replaces the running program).
    exit.0.store(true, Ordering::SeqCst);
    if let Err(e) = update.install(&bytes) {
        exit.0.store(false, Ordering::SeqCst);
        // Trying again from the notice downloads it again.
        if let Ok(mut p) = pending.found.lock() {
            *p = Some(update);
        }
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
