use serde::Serialize;
use serde::ser::SerializeStruct;
use std::io;
use std::path::Path;

/// What went wrong, as the UI distinguishes it: each kind maps to one i18n key there.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    TooLarge,
    NotUtf8,
    NotProject,
    Io,
}

/// An error of the file layer. The message is German (the default UI language) and names the
/// file; the UI shows its own translated text per kind and may add the message as detail.
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
            // A read-only target is an IO problem to the UI; the message says what to do.
            FileError::ReadOnly { .. } | FileError::Io { .. } => ErrorKind::Io,
        }
    }

    pub(crate) fn io(action: &'static str, path: &Path, source: io::Error) -> Self {
        FileError::Io { action, path: path.display().to_string(), source }
    }
}

/// Serialised for the UI as `{ "kind": "...", "message": "..." }`.
impl Serialize for FileError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("FileError", 2)?;
        s.serialize_field("kind", &self.kind())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialises_kind_and_message() {
        let e = FileError::NotUtf8 { path: "Küche.kplan".into() };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["kind"], "notUtf8");
        assert_eq!(v["message"], "„Küche.kplan“ ist keine UTF-8-Textdatei.");
        assert_eq!(v.as_object().unwrap().len(), 2);
    }

    #[test]
    fn kinds_are_camel_case() {
        let too_large = FileError::TooLarge { path: "a".into(), size: 2, limit: 1 };
        assert_eq!(serde_json::to_value(&too_large).unwrap()["kind"], "tooLarge");
        let not_project = FileError::NotProject { path: "a".into(), reason: "x".into() };
        assert_eq!(serde_json::to_value(&not_project).unwrap()["kind"], "notProject");
        let read_only = FileError::ReadOnly { path: "a".into() };
        assert_eq!(serde_json::to_value(&read_only).unwrap()["kind"], "io");
    }
}
