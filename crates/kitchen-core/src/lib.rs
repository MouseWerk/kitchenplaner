//! File IO of Kitchenplaner, free of the desktop shell so it can be tested headless.
//!
//! The UI owns the project model and its validation; this crate only guarantees that what reaches
//! the UI is a plausible project file and that what is saved never ends up half-written.

pub mod autosave;
mod error;
pub mod files;
pub mod recent;

pub use error::{ErrorKind, FileError, file_name_of};
pub use files::{
    BINARY_FILE_EXTENSIONS, MAX_PROJECT_BYTES, PROJECT_EXTENSIONS, TEXT_FILE_EXTENSIONS, check_path, read_project,
    write_atomic,
};
