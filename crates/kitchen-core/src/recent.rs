//! The list of recently opened or saved projects, kept as a JSON array of paths in the app's data
//! directory, newest first.

use crate::{FileError, write_atomic};
use std::fs;
use std::path::Path;

/// How many entries the list keeps (the start screen and the File menu show all of them).
pub const MAX_RECENT: usize = 10;

const RECENT_FILE: &str = "recent.json";

/// Puts `path` at the top of the list in `data_dir`, removing an earlier entry for the same file.
/// The data directory is created if needed.
pub fn add(data_dir: &Path, path: &str) -> Result<(), FileError> {
    add_with(data_dir, path, cfg!(windows))
}

/// The list in `data_dir`, newest first, without files that no longer exist (deleted, moved, on
/// an unplugged drive). A missing or unreadable list is an empty list: it is a convenience, not
/// user data worth an error dialog.
pub fn list(data_dir: &Path) -> Vec<String> {
    load(data_dir).into_iter().filter(|p| Path::new(p).is_file()).collect()
}

fn add_with(data_dir: &Path, path: &str, case_insensitive: bool) -> Result<(), FileError> {
    let mut entries = load(data_dir);
    let key = path_key(path, case_insensitive);
    entries.retain(|e| path_key(e, case_insensitive) != key);
    entries.insert(0, path.to_owned());
    entries.truncate(MAX_RECENT);

    fs::create_dir_all(data_dir).map_err(|e| FileError::io("Anlegen von", data_dir, e))?;
    let json = serde_json::to_vec_pretty(&entries).expect("a list of strings always serialises");
    write_atomic(data_dir.join(RECENT_FILE), &json)
}

fn load(data_dir: &Path) -> Vec<String> {
    fs::read(data_dir.join(RECENT_FILE)).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

/// Windows file systems ignore case and accept both slashes, so `C:\Küche.kplan` and
/// `c:/küche.kplan` are one file there and must be one entry.
fn path_key(path: &str, case_insensitive: bool) -> String {
    if case_insensitive { path.replace('/', "\\").to_lowercase() } else { path.to_owned() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch(dir: &Path, name: &str) -> String {
        let p = dir.join(name);
        fs::write(&p, "{}").unwrap();
        p.to_string_lossy().into_owned()
    }

    #[test]
    fn empty_when_no_list_exists() {
        let dir = tempfile::tempdir().unwrap();
        assert!(list(&dir.path().join("noch nicht angelegt")).is_empty());
    }

    #[test]
    fn newest_first_and_creates_data_dir() {
        let files = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        let data_dir = data.path().join("de.mousewerk.kitchenplaner");
        let a = touch(files.path(), "Küche Ü.kplan");
        let b = touch(files.path(), "b.kplan");
        add(&data_dir, &a).unwrap();
        add(&data_dir, &b).unwrap();
        assert_eq!(list(&data_dir), vec![b, a]);
    }

    #[test]
    fn re_adding_moves_to_top_without_duplicate() {
        let files = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        let a = touch(files.path(), "a.kplan");
        let b = touch(files.path(), "b.kplan");
        add(data.path(), &a).unwrap();
        add(data.path(), &b).unwrap();
        add(data.path(), &a).unwrap();
        assert_eq!(list(data.path()), vec![a, b]);
    }

    #[test]
    fn dedupes_case_and_slashes_when_case_insensitive() {
        let data = tempfile::tempdir().unwrap();
        add_with(data.path(), r"C:\Pläne\Küche Ü.kplan", true).unwrap();
        add_with(data.path(), "c:/pläne/küche ü.kplan", true).unwrap();
        // The newest spelling wins.
        assert_eq!(load(data.path()), vec!["c:/pläne/küche ü.kplan".to_owned()]);
    }

    #[test]
    fn keeps_case_variants_when_case_sensitive() {
        let data = tempfile::tempdir().unwrap();
        add_with(data.path(), "/home/a/Küche.kplan", false).unwrap();
        add_with(data.path(), "/home/a/küche.kplan", false).unwrap();
        assert_eq!(load(data.path()).len(), 2);
    }

    #[test]
    fn keeps_at_most_ten() {
        let files = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        let paths: Vec<String> = (0..MAX_RECENT + 3).map(|i| touch(files.path(), &format!("{i}.kplan"))).collect();
        for p in &paths {
            add(data.path(), p).unwrap();
        }
        let listed = list(data.path());
        assert_eq!(listed.len(), MAX_RECENT);
        assert_eq!(listed[0], paths[paths.len() - 1]);
        assert_eq!(listed[MAX_RECENT - 1], paths[3]);
    }

    #[test]
    fn list_drops_missing_files() {
        let files = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        let a = touch(files.path(), "a.kplan");
        let b = touch(files.path(), "b.kplan");
        add(data.path(), &a).unwrap();
        add(data.path(), &b).unwrap();
        fs::remove_file(&b).unwrap();
        assert_eq!(list(data.path()), vec![a]);
    }

    #[test]
    fn corrupt_list_counts_as_empty_and_is_replaced() {
        let files = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        fs::write(data.path().join(RECENT_FILE), "{kaputt").unwrap();
        assert!(list(data.path()).is_empty());
        let a = touch(files.path(), "a.kplan");
        add(data.path(), &a).unwrap();
        assert_eq!(list(data.path()), vec![a]);
    }
}
