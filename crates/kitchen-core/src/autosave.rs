//! Automatic backups of unsaved changes, so a crash or a power cut loses at most a few seconds of
//! work.
//!
//! Every running app is one session with a random id. While its project has unsaved changes the UI
//! hands the project text to [`Session::write`], which keeps it as `<id>.kplan` plus a small
//! `<id>.json` ([`Meta`]: original file, project name, time, app version) in the folder [`DIR`] of
//! the app data directory. Saving, opening, a new project or closing without saving removes both
//! ([`Session::clear`]).
//!
//! A session holds `<id>.lock`, locked by the operating system for as long as the process lives;
//! a crash or a power cut releases it. So another app started later (or running at the same time)
//! tells a session that is still running (locked) from one that ended without cleaning up (not
//! locked) and offers only the latter for recovery ([`Session::recoverable`]). On a file system
//! without file locks a lock file younger than [`STALE_AFTER`] counts as running; the session
//! touches it on every write.
//!
//! Taking over a backup ([`Session::restore`]) renames its file into the own session, so the
//! rename is the claim: of two apps restoring the same backup at once exactly one succeeds, and
//! the restored changes are protected by the own lock from that moment on.

use crate::{FileError, MAX_PROJECT_BYTES, read_project, write_atomic};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions, TryLockError};
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The folder of the backups in the app data directory.
pub const DIR: &str = "autosave";

/// How many backups of ended sessions are kept (newest first); older ones are removed.
pub const MAX_KEPT: usize = 5;

/// Backups older than this are removed: whoever needed them has long redone or forgotten the work.
pub const MAX_AGE: Duration = Duration::from_secs(14 * 24 * 60 * 60);

/// Without file locks, a lock file touched within this time counts as a running session.
pub const STALE_AFTER: Duration = Duration::from_secs(12 * 60 * 60);

/// A lock file younger than this always counts as running: its session may be between creating
/// the file and locking it.
const FRESH: Duration = Duration::from_secs(5);

/// A temp file of a write older than this was left by a crash (a write takes milliseconds).
const TEMP_STALE_AFTER: Duration = Duration::from_secs(60 * 60);

const PROJECT_EXT: &str = "kplan";
const META_EXT: &str = "json";
const LOCK_EXT: &str = "lock";

/// What the UI shows about a backup besides the project itself.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    /// The file the project was opened from or saved to; None for a project never saved.
    pub path: Option<String>,
    /// The project name at the time of the backup.
    pub name: String,
    /// Milliseconds since 1970-01-01 UTC.
    pub saved_at: u64,
    /// The version of the app that wrote the backup.
    pub app_version: String,
}

/// A backup of a session that ended without saving.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recoverable {
    pub id: String,
    #[serde(flatten)]
    pub meta: Meta,
    /// Whether the original file still exists (else the project comes back as a new one).
    pub path_exists: bool,
}

/// A backup taken over by [`Session::restore`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Restored {
    pub text: String,
    #[serde(flatten)]
    pub meta: Meta,
    pub path_exists: bool,
}

/// The session of this app: its id and its lock, held until it is dropped.
#[derive(Debug)]
pub struct Session {
    dir: PathBuf,
    id: String,
    /// None on a file system without file locks (the file alone marks the session).
    lock: Option<File>,
}

impl Session {
    /// Starts a session in `dir` (the [`DIR`] folder of the app data directory), creating it.
    pub fn start(dir: &Path) -> Result<Session, FileError> {
        fs::create_dir_all(dir).map_err(|e| FileError::io("Anlegen von", dir, e))?;
        let now = millis(SystemTime::now());
        let pid = std::process::id();
        for n in 0u32.. {
            let id = format!("{now:x}-{pid:x}-{n}");
            let path = dir.join(format!("{id}.{LOCK_EXT}"));
            let file = match OpenOptions::new().read(true).write(true).create_new(true).open(&path) {
                Ok(f) => f,
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(e) => return Err(FileError::io("Anlegen von", &path, e)),
            };
            let lock = match file.try_lock() {
                Ok(()) => Some(file),
                Err(TryLockError::Error(e)) if e.kind() == io::ErrorKind::Unsupported => None,
                Err(TryLockError::Error(e)) => {
                    let _ = fs::remove_file(&path);
                    return Err(FileError::io("Sperren von", &path, e));
                }
                // Nobody else knows this new name yet.
                Err(TryLockError::WouldBlock) => continue,
            };
            return Ok(Session { dir: dir.to_path_buf(), id, lock });
        }
        unreachable!("the id counter never runs out")
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    /// Keeps `project` (the project file's text) as this session's backup, replacing the last one.
    pub fn write(&self, project: &str, path: Option<&str>, name: &str, app_version: &str) -> Result<(), FileError> {
        let target = self.file(&self.id, PROJECT_EXT);
        let size = project.len() as u64;
        if size > MAX_PROJECT_BYTES {
            return Err(FileError::TooLarge { path: target.display().to_string(), size, limit: MAX_PROJECT_BYTES });
        }
        // Someone may have cleaned the data folder while the app runs.
        fs::create_dir_all(&self.dir).map_err(|e| FileError::io("Anlegen von", &self.dir, e))?;
        write_atomic(&target, project.as_bytes())?;
        let meta = Meta {
            path: path.map(str::to_owned),
            name: name.to_owned(),
            saved_at: millis(SystemTime::now()),
            app_version: app_version.to_owned(),
        };
        let json = serde_json::to_vec(&meta).expect("the meta data always serialises");
        write_atomic(self.file(&self.id, META_EXT), &json)?;
        if self.lock.is_none() {
            // Without locks the age of the lock file tells others that this session still runs.
            let _ = OpenOptions::new()
                .write(true)
                .open(self.file(&self.id, LOCK_EXT))
                .and_then(|f| f.set_modified(SystemTime::now()));
        }
        Ok(())
    }

    /// Removes this session's backup (saved, discarded or replaced by another project).
    pub fn clear(&self) -> Result<(), FileError> {
        remove(&self.file(&self.id, PROJECT_EXT))?;
        remove(&self.file(&self.id, META_EXT))
    }

    /// The backups of sessions that ended without cleaning up, newest first. Removes on the way
    /// what is no use any more: lock files of ended sessions, backups older than [`MAX_AGE`] or
    /// beyond the newest [`MAX_KEPT`], and backups that are no project file (cut off, too large).
    pub fn recoverable(&self) -> Vec<Recoverable> {
        self.remove_old_temp_files();
        let mut found: Vec<(SystemTime, Recoverable)> = Vec::new();
        for id in self.ended_sessions() {
            let project = self.file(&id, PROJECT_EXT);
            let _ = fs::remove_file(self.file(&id, LOCK_EXT));
            let Some(modified) = fs::metadata(&project).ok().and_then(|m| m.modified().ok()) else {
                // A meta file without its backup.
                let _ = fs::remove_file(self.file(&id, META_EXT));
                continue;
            };
            let age = SystemTime::now().duration_since(modified).unwrap_or_default();
            if age > MAX_AGE || read_project(&project).is_err() {
                self.remove_backup(&id);
                continue;
            }
            let meta = self.meta(&id, modified);
            let path_exists = path_exists(meta.path.as_deref());
            found.push((modified, Recoverable { id, meta, path_exists }));
        }
        found.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.id.cmp(&b.1.id)));
        for (_, old) in found.iter().skip(MAX_KEPT) {
            self.remove_backup(&old.id);
        }
        found.into_iter().take(MAX_KEPT).map(|(_, r)| r).collect()
    }

    /// Takes over the backup of the ended session `id`: it becomes this session's backup (and
    /// replaces any it had). Fails with NotFound when another app took it first.
    pub fn restore(&self, id: &str) -> Result<Restored, FileError> {
        self.check_other(id)?;
        let own = self.file(&self.id, PROJECT_EXT);
        let from = self.file(id, PROJECT_EXT);
        let modified =
            fs::metadata(&from).and_then(|m| m.modified()).map_err(|e| FileError::io("Lesen von", &from, e))?;
        // The rename is the claim (see the module comment).
        fs::rename(&from, &own).map_err(|e| FileError::io("Übernehmen von", &from, e))?;
        let meta = self.meta(id, modified);
        let _ = fs::remove_file(self.file(id, META_EXT));
        let _ = fs::remove_file(self.file(id, LOCK_EXT));
        let text = match read_project(&own) {
            Ok(text) => text,
            Err(e) => {
                let _ = self.clear();
                return Err(e);
            }
        };
        // Until the UI writes its next backup, the restored one carries its original details.
        let json = serde_json::to_vec(&meta).expect("the meta data always serialises");
        let _ = write_atomic(self.file(&self.id, META_EXT), &json);
        let path_exists = path_exists(meta.path.as_deref());
        Ok(Restored { text, meta, path_exists })
    }

    /// Removes the backup of the ended session `id` for good.
    pub fn discard(&self, id: &str) -> Result<(), FileError> {
        self.check_other(id)?;
        remove(&self.file(id, PROJECT_EXT))?;
        remove(&self.file(id, META_EXT))?;
        remove(&self.file(id, LOCK_EXT))
    }

    /// Refuses ids that are no session name (a path from a compromised UI), this session itself
    /// and sessions that are still running.
    fn check_other(&self, id: &str) -> Result<(), FileError> {
        if !valid_id(id) || id == self.id {
            return Err(FileError::BadPath { path: id.to_owned() });
        }
        if self.is_running(id) {
            return Err(FileError::io(
                "Übernehmen von",
                &self.file(id, PROJECT_EXT),
                io::Error::from(io::ErrorKind::ResourceBusy),
            ));
        }
        Ok(())
    }

    fn file(&self, id: &str, ext: &str) -> PathBuf {
        self.dir.join(format!("{id}.{ext}"))
    }

    /// Ids of the other sessions in the folder that are not running.
    fn ended_sessions(&self) -> Vec<String> {
        let Ok(entries) = fs::read_dir(&self.dir) else { return Vec::new() };
        let mut ids: Vec<String> = entries
            .flatten()
            .filter_map(|e| {
                let name = e.file_name().into_string().ok()?;
                let (id, ext) = name.rsplit_once('.')?;
                ([PROJECT_EXT, META_EXT, LOCK_EXT].contains(&ext) && valid_id(id) && id != self.id)
                    .then(|| id.to_owned())
            })
            .collect();
        ids.sort();
        ids.dedup();
        ids.retain(|id| !self.is_running(id));
        ids
    }

    /// Whether the session `id` still runs: its lock file is locked, or too fresh to tell.
    fn is_running(&self, id: &str) -> bool {
        let path = self.file(id, LOCK_EXT);
        let Ok(meta) = fs::metadata(&path) else { return false };
        let age = meta.modified().ok().and_then(|t| SystemTime::now().duration_since(t).ok());
        if age.is_some_and(|a| a < FRESH) {
            return true;
        }
        let Ok(file) = OpenOptions::new().read(true).write(true).open(&path) else { return false };
        match file.try_lock() {
            Ok(()) => {
                let _ = file.unlock();
                false
            }
            Err(TryLockError::WouldBlock) => true,
            Err(TryLockError::Error(_)) => age.is_none_or(|a| a < STALE_AFTER),
        }
    }

    /// The meta data of `id`; a missing or damaged meta file still leaves the backup worth
    /// offering, with what is known: the time of the backup file.
    fn meta(&self, id: &str, modified: SystemTime) -> Meta {
        fs::read(self.file(id, META_EXT)).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_else(|| Meta {
            path: None,
            name: String::new(),
            saved_at: millis(modified),
            app_version: String::new(),
        })
    }

    /// Temp files of [`write_atomic`] that a crash in the middle of a write left behind.
    fn remove_old_temp_files(&self) {
        let Ok(entries) = fs::read_dir(&self.dir) else { return };
        for e in entries.flatten() {
            let is_temp = e.file_name().to_str().is_some_and(|n| n.starts_with('.') && n.ends_with(".tmp"));
            let age = e
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| SystemTime::now().duration_since(t).ok());
            if is_temp && age.is_some_and(|a| a > TEMP_STALE_AFTER) {
                let _ = fs::remove_file(e.path());
            }
        }
    }

    fn remove_backup(&self, id: &str) {
        for ext in [PROJECT_EXT, META_EXT, LOCK_EXT] {
            let _ = fs::remove_file(self.file(id, ext));
        }
    }
}

impl Drop for Session {
    /// A session that ends cleanly removes its lock file; a backup it still has stays and is
    /// offered at the next start (the system shut down with unsaved changes).
    fn drop(&mut self) {
        if let Some(file) = self.lock.take() {
            let _ = file.unlock();
        }
        let _ = fs::remove_file(self.file(&self.id, LOCK_EXT));
    }
}

/// Session ids are made by [`Session::start`]: lower-case hex digits and dashes.
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b == b'-')
}

/// Only project paths are looked up: the meta file must not become a way to probe for any file.
fn path_exists(path: Option<&str>) -> bool {
    path.is_some_and(|p| crate::check_path(p, crate::PROJECT_EXTENSIONS).is_ok() && Path::new(p).is_file())
}

fn remove(path: &Path) -> Result<(), FileError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(FileError::io("Löschen von", path, e)),
    }
}

fn millis(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ErrorKind;

    const PROJECT: &str = r#"{"format":"kitchenplaner","version":3,"info":{"name":"Küche Süd"}}"#;

    /// What a crash leaves: the lock released by the system, every file still there.
    fn crash(mut s: Session) {
        drop(s.lock.take());
        std::mem::forget(s);
    }

    /// Ages every file of session `id` by `by` (the FRESH guard and MAX_AGE look at the file times).
    fn age(dir: &Path, id: &str, by: Duration) {
        for ext in [PROJECT_EXT, META_EXT, LOCK_EXT] {
            if let Ok(f) = OpenOptions::new().write(true).open(dir.join(format!("{id}.{ext}"))) {
                f.set_modified(SystemTime::now() - by).unwrap();
            }
        }
    }

    fn names(dir: &Path) -> Vec<String> {
        let mut v: Vec<String> =
            fs::read_dir(dir).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
        v.sort();
        v
    }

    /// A session that crashed with `text` as its backup, aged past the FRESH guard.
    fn crashed(dir: &Path, text: &str, path: Option<&str>, name: &str) -> String {
        let s = Session::start(dir).unwrap();
        s.write(text, path, name, "0.2.0").unwrap();
        let id = s.id().to_owned();
        crash(s);
        age(dir, &id, Duration::from_secs(60));
        id
    }

    #[test]
    fn a_crashed_session_is_offered_with_its_details() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let original = tmp.path().join("Küche Ü.kplan");
        fs::write(&original, PROJECT).unwrap();
        let original = original.to_string_lossy().into_owned();
        let id = crashed(&dir, PROJECT, Some(&original), "Küche Süd");

        let now = Session::start(&dir).unwrap();
        let found = now.recoverable();
        assert_eq!(found.len(), 1);
        let r = &found[0];
        assert_eq!(r.id, id);
        assert_eq!(r.meta.path.as_deref(), Some(original.as_str()));
        assert_eq!(r.meta.name, "Küche Süd");
        assert_eq!(r.meta.app_version, "0.2.0");
        assert!(r.path_exists);
        assert!(r.meta.saved_at > 0);
        // The ended session's lock file is gone; the backup stays until restored or discarded.
        assert!(!dir.join(format!("{id}.lock")).exists());
        assert_eq!(now.recoverable().len(), 1);

        let v = serde_json::to_value(r).unwrap();
        assert_eq!(v["name"], "Küche Süd");
        assert_eq!(v["pathExists"], true);
        assert!(v["savedAt"].is_u64() && v["appVersion"].is_string());
    }

    #[test]
    fn a_running_session_is_never_offered() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        // Two apps at once: the other one has unsaved changes and keeps running.
        let other = Session::start(&dir).unwrap();
        other.write(PROJECT, None, "Andere", "0.2.0").unwrap();
        age(&dir, other.id(), Duration::from_secs(60));
        let me = Session::start(&dir).unwrap();
        assert!(me.recoverable().is_empty());
        assert_eq!(me.restore(other.id()).unwrap_err().kind(), ErrorKind::Io);
        assert_eq!(me.discard(other.id()).unwrap_err().kind(), ErrorKind::Io);
        assert!(dir.join(format!("{}.kplan", other.id())).exists(), "the running session keeps its backup");
        // And it does not see this one's backup either.
        me.write(PROJECT, None, "Ich", "0.2.0").unwrap();
        age(&dir, me.id(), Duration::from_secs(60));
        assert!(other.recoverable().is_empty());
        // Once it crashes, the other app offers it.
        let id = other.id().to_owned();
        crash(other);
        assert_eq!(me.recoverable().iter().map(|r| r.id.clone()).collect::<Vec<_>>(), vec![id]);
    }

    #[test]
    fn a_fresh_unlocked_lock_file_counts_as_running() {
        // A session between creating its lock file and locking it.
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let me = Session::start(&dir).unwrap();
        fs::write(dir.join("abc-1-0.lock"), "").unwrap();
        fs::write(dir.join("abc-1-0.kplan"), PROJECT).unwrap();
        assert!(me.recoverable().is_empty());
        assert!(dir.join("abc-1-0.lock").exists());
        age(&dir, "abc-1-0", Duration::from_secs(60));
        assert_eq!(me.recoverable().len(), 1);
    }

    #[test]
    fn clear_and_a_clean_end_leave_nothing_behind() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let s = Session::start(&dir).unwrap();
        s.write(PROJECT, None, "A", "0.2.0").unwrap();
        s.write(PROJECT, None, "A2", "0.2.0").unwrap();
        assert_eq!(names(&dir).len(), 3);
        s.clear().unwrap();
        s.clear().unwrap();
        assert_eq!(names(&dir), vec![format!("{}.lock", s.id())]);
        drop(s);
        assert!(names(&dir).is_empty());
    }

    #[test]
    fn a_clean_end_with_a_backup_keeps_it_for_the_next_start() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let s = Session::start(&dir).unwrap();
        s.write(PROJECT, None, "A", "0.2.0").unwrap();
        let id = s.id().to_owned();
        drop(s);
        let next = Session::start(&dir).unwrap();
        assert_eq!(next.recoverable().len(), 1, "no lock file at all: ended");
        assert_eq!(next.recoverable()[0].id, id);
    }

    #[test]
    fn restore_moves_the_backup_into_the_own_session() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let id = crashed(&dir, PROJECT, Some("/weg/Küche.kplan"), "Küche Süd");
        let me = Session::start(&dir).unwrap();
        let r = me.restore(&id).unwrap();
        assert_eq!(r.text, PROJECT);
        assert_eq!(r.meta.name, "Küche Süd");
        assert_eq!(r.meta.path.as_deref(), Some("/weg/Küche.kplan"));
        assert!(!r.path_exists, "the original is gone: the UI opens it as a new project");
        assert_eq!(
            names(&dir),
            vec![format!("{}.json", me.id()), format!("{}.kplan", me.id()), format!("{}.lock", me.id())]
        );
        // A crash right after the restore still has the changes.
        let my_id = me.id().to_owned();
        crash(me);
        age(&dir, &my_id, Duration::from_secs(60));
        let later = Session::start(&dir).unwrap();
        let again = later.recoverable();
        assert_eq!(again.len(), 1);
        assert_eq!(again[0].meta.name, "Küche Süd");
    }

    #[test]
    fn of_two_apps_restoring_one_backup_only_one_gets_it() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let id = crashed(&dir, PROJECT, None, "A");
        let a = Session::start(&dir).unwrap();
        let b = Session::start(&dir).unwrap();
        assert_eq!(a.recoverable().len(), 1);
        assert_eq!(b.recoverable().len(), 1);
        a.restore(&id).unwrap();
        assert_eq!(b.restore(&id).unwrap_err().kind(), ErrorKind::NotFound);
        assert!(b.recoverable().is_empty(), "a's restored backup is locked by a");
    }

    #[test]
    fn discard_removes_the_backup_for_good() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let id = crashed(&dir, PROJECT, None, "A");
        let me = Session::start(&dir).unwrap();
        me.discard(&id).unwrap();
        assert!(me.recoverable().is_empty());
        assert_eq!(names(&dir), vec![format!("{}.lock", me.id())]);
    }

    #[test]
    fn foreign_ids_are_refused() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let me = Session::start(&dir).unwrap();
        fs::write(tmp.path().join("geheim.kplan"), PROJECT).unwrap();
        for id in ["../geheim", "", "ABC", "a/b", "a.b", me.id()] {
            assert_eq!(me.restore(id).unwrap_err().kind(), ErrorKind::BadPath, "{id:?}");
            assert_eq!(me.discard(id).unwrap_err().kind(), ErrorKind::BadPath, "{id:?}");
        }
        assert!(tmp.path().join("geheim.kplan").exists());
    }

    #[test]
    fn a_damaged_meta_file_still_offers_the_backup() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let id = crashed(&dir, PROJECT, Some("/a.kplan"), "A");
        fs::write(dir.join(format!("{id}.json")), "{kaputt").unwrap();
        age(&dir, &id, Duration::from_secs(60));
        let me = Session::start(&dir).unwrap();
        let found = me.recoverable();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].meta.name, "");
        assert_eq!(found[0].meta.path, None);
        assert!(found[0].meta.saved_at > 0, "the time of the backup file");
        // A meta file without a backup is left over: removed.
        fs::write(dir.join("abc-2-0.json"), "{}").unwrap();
        age(&dir, "abc-2-0", Duration::from_secs(60));
        me.recoverable();
        assert!(!dir.join("abc-2-0.json").exists());
    }

    #[test]
    fn damaged_old_and_surplus_backups_are_removed() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let cut = crashed(&dir, r#"{"format":"kitchenplaner","vers"#, None, "abgeschnitten");
        let old = crashed(&dir, PROJECT, None, "alt");
        age(&dir, &old, MAX_AGE + Duration::from_secs(60));
        let mut kept = Vec::new();
        for i in 0..MAX_KEPT + 2 {
            let id = crashed(&dir, PROJECT, None, &format!("P{i}"));
            // Newer ones later: P0 is the oldest.
            age(&dir, &id, Duration::from_secs(600 - i as u64 * 10));
            kept.push(id);
        }
        let me = Session::start(&dir).unwrap();
        let found: Vec<String> = me.recoverable().into_iter().map(|r| r.meta.name).collect();
        assert_eq!(found, vec!["P6", "P5", "P4", "P3", "P2"]);
        for gone in [&cut, &old, &kept[0], &kept[1]] {
            assert!(!dir.join(format!("{gone}.kplan")).exists(), "{gone}");
            assert!(!dir.join(format!("{gone}.json")).exists(), "{gone}");
        }
    }

    #[test]
    fn too_large_projects_are_refused_before_writing() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let s = Session::start(&dir).unwrap();
        let big = "x".repeat(MAX_PROJECT_BYTES as usize + 1);
        assert_eq!(s.write(&big, None, "A", "0.2.0").unwrap_err().kind(), ErrorKind::TooLarge);
        assert_eq!(names(&dir), vec![format!("{}.lock", s.id())]);
    }

    #[test]
    fn ids_are_unique_and_valid() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let a = Session::start(&dir).unwrap();
        let b = Session::start(&dir).unwrap();
        assert_ne!(a.id(), b.id());
        assert!(valid_id(a.id()) && valid_id(b.id()), "{} {}", a.id(), b.id());
    }

    #[test]
    fn temp_files_of_an_interrupted_write_are_removed_when_old() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(DIR);
        let me = Session::start(&dir).unwrap();
        let old = dir.join(".abc-1-0.kplan.77-0.tmp");
        let new = dir.join(".abc-1-0.kplan.78-0.tmp");
        fs::write(&old, "halb").unwrap();
        fs::write(&new, "halb").unwrap();
        OpenOptions::new()
            .write(true)
            .open(&old)
            .unwrap()
            .set_modified(SystemTime::now() - TEMP_STALE_AFTER * 2)
            .unwrap();
        me.recoverable();
        assert!(!old.exists());
        assert!(new.exists(), "a write of a running session may be in progress");
    }
}
