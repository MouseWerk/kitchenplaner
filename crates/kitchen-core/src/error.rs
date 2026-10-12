use serde::Serialize;
use serde::ser::SerializeStruct;
use std::io;
use std::path::Path;

/// What went wrong, as the UI distinguishes it: each kind maps to one i18n key there. The names
/// are part of the IPC contract with `ui/src/lib/errors.ts`; renaming one breaks its text.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    TooLarge,
    NotUtf8,
    NotProject,
    ReadOnly,
    NotFound,
    PermissionDenied,
    BadExtension,
    BadPath,
    /// Anything else; the UI shows the OS text from `detail`.
    Io,
}

/// An error of the file layer. The Display text is German and meant for logs and tests; the UI
/// builds its own text in the user's language from the serialised kind, file name and detail.
#[derive(Debug, thiserror::Error)]
pub enum FileError {
    #[error("„{path}“ ist zu groß ({size} Bytes, höchstens {limit} Bytes).")]
    TooLarge { path: String, size: u64, limit: u64 },
    #[error("„{path}“ ist keine UTF-8-Textdatei.")]
    NotUtf8 { path: String },
    #[error("„{path}“ ist keine Kitchenplaner-Projektdatei: {reason}")]
    NotProject { path: String, reason: String },
    #[error("„{path}“ ist schreibgeschützt. Speichere unter einem anderen Namen oder hebe den Schreibschutz auf.")]
    ReadOnly { path: String },
    #[error("„{path}“ hat keine der erlaubten Endungen ({allowed}).")]
    BadExtension { path: String, allowed: String },
    #[error("„{path}“ ist kein absoluter Dateipfad.")]
    BadPath { path: String },
    #[error("{action} „{path}“ fehlgeschlagen: {source}")]
    Io {
        action: &'static str,
        path: String,
        #[source]
        source: io::Error,
    },
}

impl FileError {
    pub fn kind(&self) -> ErrorKind {
        match self {
            FileError::TooLarge { .. } => ErrorKind::TooLarge,
            FileError::NotUtf8 { .. } => ErrorKind::NotUtf8,
            FileError::NotProject { .. } => ErrorKind::NotProject,
            FileError::ReadOnly { .. } => ErrorKind::ReadOnly,
            FileError::BadExtension { .. } => ErrorKind::BadExtension,
            FileError::BadPath { .. } => ErrorKind::BadPath,
            FileError::Io { source, .. } => match source.kind() {
                io::ErrorKind::NotFound => ErrorKind::NotFound,
                io::ErrorKind::PermissionDenied => ErrorKind::PermissionDenied,
                io::ErrorKind::ReadOnlyFilesystem => ErrorKind::ReadOnly,
                _ => ErrorKind::Io,
            },
        }
    }

    /// The path as it was given (full, for logs).
    pub fn path(&self) -> &str {
        match self {
            FileError::TooLarge { path, .. }
            | FileError::NotUtf8 { path }
            | FileError::NotProject { path, .. }
            | FileError::ReadOnly { path }
            | FileError::BadExtension { path, .. }
            | FileError::BadPath { path }
            | FileError::Io { path, .. } => path,
        }
    }

    /// The file name for the user's message: the folder rarely helps and makes toasts unreadable.
    pub fn file_name(&self) -> String {
        file_name_of(self.path())
    }

    /// Extra text for the generic case only: the OS error. The other kinds are fully described by
    /// the UI's own text, and their German reasons would leak into the English UI.
    pub fn detail(&self) -> Option<String> {
        match self {
            FileError::Io { source, .. } if self.kind() == ErrorKind::Io => Some(source.to_string()),
            _ => None,
        }
    }

    pub(crate) fn io(action: &'static str, path: &Path, source: io::Error) -> Self {
        FileError::Io { action, path: path.display().to_string(), source }
    }
}

/// The last component of `path`, or the whole string when it has none (`C:\`, `..`). Both
/// separators count on every OS: a Windows path may reach a Unix build through the recent list.
pub fn file_name_of(path: &str) -> String {
    let trimmed = path.trim_end_matches(['/', '\\']);
    match trimmed.rsplit(['/', '\\']).next() {
        Some(name) if !name.is_empty() => name.to_owned(),
        _ => path.to_owned(),
    }
}

/// Serialised for the UI as `{ "kind": "...", "path": "<file name>", "detail": "..." | null }`.
impl Serialize for FileError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("FileError", 3)?;
        s.serialize_field("kind", &self.kind())?;
        s.serialize_field("path", &self.file_name())?;
        s.serialize_field("detail", &self.detail())?;
        s.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn io_error(kind: io::ErrorKind) -> FileError {
        FileError::io("Öffnen von", Path::new("/pläne/Küche.kplan"), io::Error::new(kind, "OS-Text"))
    }

    #[test]
    fn serialises_kind_file_name_and_detail() {
        let e = FileError::NotUtf8 { path: "/pläne/Küche.kplan".into() };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v, serde_json::json!({ "kind": "notUtf8", "path": "Küche.kplan", "detail": null }));
    }

    #[test]
    fn generic_io_error_carries_the_os_text() {
        let v = serde_json::to_value(io_error(io::ErrorKind::Other)).unwrap();
        assert_eq!(v, serde_json::json!({ "kind": "io", "path": "Küche.kplan", "detail": "OS-Text" }));
    }

    #[test]
    fn every_kind_the_user_can_hit_has_its_own_name() {
        let cases: [(FileError, &str); 10] = [
            (FileError::TooLarge { path: "a".into(), size: 2, limit: 1 }, "tooLarge"),
            (FileError::NotUtf8 { path: "a".into() }, "notUtf8"),
            (FileError::NotProject { path: "a".into(), reason: "x".into() }, "notProject"),
            (FileError::ReadOnly { path: "a".into() }, "readOnly"),
            (FileError::BadExtension { path: "a".into(), allowed: ".kplan".into() }, "badExtension"),
            (FileError::BadPath { path: "a".into() }, "badPath"),
            (io_error(io::ErrorKind::NotFound), "notFound"),
            (io_error(io::ErrorKind::PermissionDenied), "permissionDenied"),
            (io_error(io::ErrorKind::ReadOnlyFilesystem), "readOnly"),
            (io_error(io::ErrorKind::Other), "io"),
        ];
        for (e, kind) in cases {
            let v = serde_json::to_value(&e).unwrap();
            assert_eq!(v["kind"], kind, "{e}");
            // Only the generic case explains itself with the OS text.
            assert_eq!(v["detail"].is_string(), kind == "io", "{e}");
        }
    }

    #[test]
    fn file_name_drops_the_folder_on_any_separator() {
        assert_eq!(file_name_of(r"C:\Pläne\Küche Ü.kplan"), "Küche Ü.kplan");
        assert_eq!(file_name_of("/home/a/b.svg"), "b.svg");
        assert_eq!(file_name_of("/home/a/dir/"), "dir");
        assert_eq!(file_name_of("plan.kplan"), "plan.kplan");
        assert_eq!(file_name_of("/"), "/");
    }
}
