//! Reading project files and writing any file atomically.

use crate::FileError;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

/// Largest project file accepted. A plan with hundreds of items is well under 1 MB; the limit only
/// keeps a wrongly chosen file (a video, a disk image) from being loaded into the WebView.
pub const MAX_PROJECT_BYTES: u64 = 50 * 1024 * 1024;

/// The `format` value every project file carries (see docs/ARCHITECTURE.md).
const PROJECT_FORMAT: &str = "kitchenplaner";

const UTF8_BOM: &str = "\u{feff}";

/// What the shell may read as a project. The extension lists name the only files the UI ever
/// produces; limiting the commands to them keeps a compromised WebView from reading or
/// overwriting arbitrary files (`.bashrc`, a DLL next to an executable).
pub const PROJECT_EXTENSIONS: &[&str] = &["kplan"];
/// What the shell may write as text: the project and the SVG, DXF and CSV exports.
pub const TEXT_FILE_EXTENSIONS: &[&str] = &["kplan", "svg", "dxf", "csv"];
/// What the shell may write as binary: the PNG exports and the PDF plan set.
pub const BINARY_FILE_EXTENSIONS: &[&str] = &["png", "pdf"];

/// Accepts only an absolute path without NUL whose extension is one of `allowed`, ignoring case
/// (save dialogs keep whatever case the user typed). Relative paths are refused because they
/// would resolve against the app's working directory, which the user never chose.
pub fn check_path(path: impl AsRef<Path>, allowed: &[&str]) -> Result<(), FileError> {
    let path = path.as_ref();
    let shown = || path.display().to_string();
    // The OS APIs reject an embedded NUL anyway; refusing it here gives a clear kind and keeps a
    // truncated name from ever reaching a lower layer.
    if path.as_os_str().as_encoded_bytes().contains(&0) || !path.is_absolute() {
        return Err(FileError::BadPath { path: shown() });
    }
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !allowed.iter().any(|a| a.eq_ignore_ascii_case(ext)) {
        let allowed = allowed.iter().map(|a| format!(".{a}")).collect::<Vec<_>>().join(", ");
        return Err(FileError::BadExtension { path: shown(), allowed });
    }
    Ok(())
}

/// Reads a project file and checks its envelope: a JSON object with `"format": "kitchenplaner"`
/// and a numeric `"version"`. The UI validates and migrates the content itself; this only makes
/// sure it receives text that is meant to be a project. Returns the text without a UTF-8 BOM.
/// Only absolute `.kplan` paths are read (see [`check_path`]).
pub fn read_project(path: impl AsRef<Path>) -> Result<String, FileError> {
    let path = path.as_ref();
    check_path(path, PROJECT_EXTENSIONS)?;
    let file = File::open(path).map_err(|e| FileError::io("Öffnen von", path, e))?;
    let size = file.metadata().map_err(|e| FileError::io("Lesen von", path, e))?.len();
    if size > MAX_PROJECT_BYTES {
        return Err(too_large(path, size));
    }
    // Read at most one byte past the limit: the file may have grown since the size check.
    let mut bytes = Vec::with_capacity(size as usize);
    file.take(MAX_PROJECT_BYTES + 1).read_to_end(&mut bytes).map_err(|e| FileError::io("Lesen von", path, e))?;
    if bytes.len() as u64 > MAX_PROJECT_BYTES {
        return Err(too_large(path, bytes.len() as u64));
    }
    let text = String::from_utf8(bytes).map_err(|_| FileError::NotUtf8 { path: path.display().to_string() })?;
    // Editors on Windows (Notepad) may add a BOM when someone touches the file by hand.
    let text = match text.strip_prefix(UTF8_BOM) {
        Some(rest) => rest.to_owned(),
        None => text,
    };
    check_envelope(&text).map_err(|reason| FileError::NotProject { path: path.display().to_string(), reason })?;
    Ok(text)
}

fn too_large(path: &Path, size: u64) -> FileError {
    FileError::TooLarge { path: path.display().to_string(), size, limit: MAX_PROJECT_BYTES }
}

fn check_envelope(text: &str) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(text).map_err(|e| format!("kein gültiges JSON ({e})."))?;
    let object = value.as_object().ok_or("kein JSON-Objekt.")?;
    if object.get("format").and_then(|f| f.as_str()) != Some(PROJECT_FORMAT) {
        return Err(format!("das Feld „format“ ist nicht „{PROJECT_FORMAT}“."));
    }
    if !object.get("version").is_some_and(|v| v.is_number()) {
        return Err("das Feld „version“ fehlt oder ist keine Zahl.".into());
    }
    Ok(())
}

/// Writes `bytes` to `path` so that the file afterwards holds either the old or the new content,
/// never a mix: a temp file in the same directory (same volume, so the rename is atomic) is
/// written and flushed to disk, then renamed over the target. On any failure the temp file is
/// removed and the target is untouched. Takes any path (the recent list lives outside the user's
/// folders): callers passing a path from the UI check it with [`check_path`] first.
pub fn write_atomic(path: impl AsRef<Path>, bytes: &[u8]) -> Result<(), FileError> {
    let path = path.as_ref();
    // Windows refuses to replace a read-only file with a bare "access denied", and Unix would
    // replace it silently: both are wrong for a file the user protected.
    if let Ok(meta) = fs::metadata(path)
        && meta.is_file()
        && meta.permissions().readonly()
    {
        return Err(FileError::ReadOnly { path: path.display().to_string() });
    }
    let dir = match path.parent() {
        Some(p) if !p.as_os_str().is_empty() => p,
        _ => Path::new("."),
    };
    let (tmp_path, mut tmp) = create_temp(dir, path).map_err(|e| FileError::io("Speichern von", path, e))?;
    let result = tmp.write_all(bytes).and_then(|_| tmp.sync_all()).and_then(|_| {
        drop(tmp);
        // std::fs::rename replaces an existing target on Windows too (MoveFileExW with
        // MOVEFILE_REPLACE_EXISTING).
        fs::rename(&tmp_path, path)
    });
    if let Err(e) = result {
        let _ = fs::remove_file(&tmp_path);
        return Err(FileError::io("Speichern von", path, e));
    }
    sync_dir(dir);
    Ok(())
}

/// Creates a new, unique temp file next to `target`. The name starts with a dot and ends in
/// `.tmp` so a leftover from a crash is recognisable and hidden on Unix.
fn create_temp(dir: &Path, target: &Path) -> io::Result<(PathBuf, File)> {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let stem = target.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    loop {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let candidate = dir.join(format!(".{stem}.{}-{n}.tmp", std::process::id()));
        match OpenOptions::new().write(true).create_new(true).open(&candidate) {
            Ok(file) => return Ok((candidate, file)),
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        }
    }
}

/// Makes the rename itself durable on Unix (the directory entry). Windows has no directory
/// handles for this; NTFS journals the rename. Best effort: the data is already on disk.
fn sync_dir(dir: &Path) {
    #[cfg(unix)]
    if let Ok(d) = File::open(dir) {
        let _ = d.sync_all();
    }
    #[cfg(not(unix))]
    let _ = dir;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ErrorKind;

    const VALID: &str = r#"{"format":"kitchenplaner","version":1,"items":[]}"#;

    fn temp_entries(dir: &Path) -> Vec<String> {
        fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|n| n.ends_with(".tmp"))
            .collect()
    }

    fn set_readonly(path: &Path, readonly: bool) {
        let mut perms = fs::metadata(path).unwrap().permissions();
        #[allow(clippy::permissions_set_readonly_false)]
        perms.set_readonly(readonly);
        fs::set_permissions(path, perms).unwrap();
    }

    #[test]
    fn reads_valid_project_with_unicode_name() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("Küche Ü.kplan");
        fs::write(&path, VALID).unwrap();
        assert_eq!(read_project(&path).unwrap(), VALID);
    }

    #[test]
    fn strips_utf8_bom() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bom.kplan");
        fs::write(&path, format!("{UTF8_BOM}{VALID}")).unwrap();
        assert_eq!(read_project(&path).unwrap(), VALID);
    }

    #[test]
    fn keeps_non_ascii_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("p.kplan");
        let text = r#"{"format":"kitchenplaner","version":2.0,"name":"Großküche „Süd“"}"#;
        fs::write(&path, text).unwrap();
        assert_eq!(read_project(&path).unwrap(), text);
    }

    #[test]
    fn rejects_oversized_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("groß.kplan");
        let file = File::create(&path).unwrap();
        // Sparse on most file systems: cheap to create.
        file.set_len(MAX_PROJECT_BYTES + 1).unwrap();
        drop(file);
        let err = read_project(&path).unwrap_err();
        assert_eq!(err.kind(), ErrorKind::TooLarge);
        assert!(err.to_string().contains("groß.kplan"));
    }

    #[test]
    fn file_at_the_limit_passes_the_size_check() {
        // The limit is inclusive; the zero bytes then fail the envelope check, not the size check.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("limit.kplan");
        let file = File::create(&path).unwrap();
        file.set_len(MAX_PROJECT_BYTES).unwrap();
        drop(file);
        assert_eq!(read_project(&path).unwrap_err().kind(), ErrorKind::NotProject);
    }

    #[test]
    fn rejects_invalid_utf8() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("latin1.kplan");
        fs::write(&path, b"{\"format\":\"kitchenplaner\",\"version\":1,\"name\":\"K\xfcche\"}").unwrap();
        assert_eq!(read_project(&path).unwrap_err().kind(), ErrorKind::NotUtf8);
    }

    #[test]
    fn rejects_non_projects() {
        let dir = tempfile::tempdir().unwrap();
        let cases = [
            "",
            "not json",
            "[1,2,3]",
            "\"kitchenplaner\"",
            r#"{"version":1}"#,
            r#"{"format":"other","version":1}"#,
            r#"{"format":"Kitchenplaner","version":1}"#,
            r#"{"format":"kitchenplaner"}"#,
            r#"{"format":"kitchenplaner","version":"1"}"#,
            r#"{"format":"kitchenplaner","version":null}"#,
            r#"{"format":"kitchenplaner","version":1} trailing"#,
        ];
        for (i, text) in cases.iter().enumerate() {
            let path = dir.path().join(format!("{i}.kplan"));
            fs::write(&path, text).unwrap();
            let err = read_project(&path).unwrap_err();
            assert_eq!(err.kind(), ErrorKind::NotProject, "case {text:?}");
        }
    }

    #[test]
    fn missing_file_is_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let err = read_project(dir.path().join("fehlt.kplan")).unwrap_err();
        assert_eq!(err.kind(), ErrorKind::NotFound);
        assert_eq!(err.file_name(), "fehlt.kplan");
        assert!(err.to_string().contains("fehlt.kplan"));
    }

    #[test]
    fn writes_new_file_with_unicode_name() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("Küche Ü.kplan");
        write_atomic(&path, VALID.as_bytes()).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), VALID);
        assert!(temp_entries(dir.path()).is_empty());
    }

    #[test]
    fn replaces_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("plan.kplan");
        fs::write(&path, "alt, viel längerer Inhalt als der neue").unwrap();
        write_atomic(&path, b"neu").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "neu");
        assert!(temp_entries(dir.path()).is_empty());
    }

    #[test]
    fn writes_binary_and_empty_content() {
        let dir = tempfile::tempdir().unwrap();
        let png = dir.path().join("bild.png");
        let bytes: Vec<u8> = (0..=255).collect();
        write_atomic(&png, &bytes).unwrap();
        assert_eq!(fs::read(&png).unwrap(), bytes);
        let empty = dir.path().join("leer.csv");
        write_atomic(&empty, b"").unwrap();
        assert_eq!(fs::read(&empty).unwrap(), b"");
    }

    #[test]
    fn missing_directory_fails_and_creates_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gibt es nicht").join("plan.kplan");
        let err = write_atomic(&path, b"neu").unwrap_err();
        assert_eq!(err.kind(), ErrorKind::NotFound);
        assert!(!path.exists());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    #[test]
    fn failed_rename_keeps_old_content_and_removes_temp() {
        // The target is a non-empty directory: the temp file is written, the rename fails.
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("plan.kplan");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("inhalt.txt"), "alt").unwrap();
        let err = write_atomic(&target, b"neu").unwrap_err();
        // Windows reports "access denied", Unix "is a directory".
        assert!(matches!(err.kind(), ErrorKind::Io | ErrorKind::PermissionDenied), "{err}");
        assert_eq!(fs::read_to_string(target.join("inhalt.txt")).unwrap(), "alt");
        assert!(temp_entries(dir.path()).is_empty());
    }

    #[test]
    fn read_only_target_is_refused_with_clear_message() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("geschützt.kplan");
        fs::write(&path, "alt").unwrap();
        set_readonly(&path, true);

        let err = write_atomic(&path, b"neu").unwrap_err();
        assert!(matches!(err, FileError::ReadOnly { .. }));
        assert_eq!(err.kind(), ErrorKind::ReadOnly);
        assert!(err.to_string().contains("schreibgeschützt"));
        assert_eq!(fs::read_to_string(&path).unwrap(), "alt");
        assert!(temp_entries(dir.path()).is_empty());

        // Windows cannot delete a read-only file when the temp dir is cleaned up.
        set_readonly(&path, false);
    }

    #[test]
    fn round_trip_through_write_and_read() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("Ölküche – Entwurf 2.kplan");
        write_atomic(&path, VALID.as_bytes()).unwrap();
        assert_eq!(read_project(&path).unwrap(), VALID);
    }

    #[test]
    fn check_path_accepts_allowed_extensions_in_any_case() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["a.kplan", "b.SVG", "c.Dxf", "d.csv", "Küche Ü.KPLAN"] {
            check_path(dir.path().join(name), TEXT_FILE_EXTENSIONS).unwrap();
        }
        check_path(dir.path().join("bild.PNG"), BINARY_FILE_EXTENSIONS).unwrap();
        check_path(dir.path().join("Plansatz Küche.PDF"), BINARY_FILE_EXTENSIONS).unwrap();
    }

    #[test]
    fn check_path_refuses_other_extensions() {
        let dir = tempfile::tempdir().unwrap();
        let refused: [(&str, &[&str]); 9] = [
            ("a.png", TEXT_FILE_EXTENSIONS),
            // A PDF is binary: the text command would mangle it.
            ("a.pdf", TEXT_FILE_EXTENSIONS),
            ("a.pdf", PROJECT_EXTENSIONS),
            ("a.exe", TEXT_FILE_EXTENSIONS),
            ("a.kplan.bat", TEXT_FILE_EXTENSIONS),
            ("ohne_endung", TEXT_FILE_EXTENSIONS),
            // A dot file has no extension: ".kplan" is a name, not a project.
            (".kplan", PROJECT_EXTENSIONS),
            ("a.svg", PROJECT_EXTENSIONS),
            ("a.kplan", BINARY_FILE_EXTENSIONS),
        ];
        for (name, allowed) in refused {
            let err = check_path(dir.path().join(name), allowed).unwrap_err();
            assert_eq!(err.kind(), ErrorKind::BadExtension, "{name}");
        }
    }

    #[test]
    fn check_path_refuses_relative_paths_and_nul() {
        for path in ["plan.kplan", "../plan.kplan", "sub/plan.kplan"] {
            assert_eq!(check_path(path, PROJECT_EXTENSIONS).unwrap_err().kind(), ErrorKind::BadPath, "{path}");
        }
        let dir = tempfile::tempdir().unwrap();
        let with_nul = dir.path().join("a\0b.kplan");
        assert_eq!(check_path(with_nul, PROJECT_EXTENSIONS).unwrap_err().kind(), ErrorKind::BadPath);
    }

    #[test]
    fn read_project_refuses_other_files_before_opening_them() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("notiz.txt");
        fs::write(&path, VALID).unwrap();
        assert_eq!(read_project(&path).unwrap_err().kind(), ErrorKind::BadExtension);
        assert_eq!(read_project("plan.kplan").unwrap_err().kind(), ErrorKind::BadPath);
    }
}
