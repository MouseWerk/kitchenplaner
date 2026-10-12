//! File IO of Kitchenplaner, free of the desktop shell so it can be tested headless.
//!
//! The UI owns the project model and its validation; this crate only guarantees that what reaches
//! the UI is a plausible project file and that what is saved never ends up half-written.

mod error;
pub mod files;
pub mod recent;

pub use error::{ErrorKind, FileError};
pub use files::{MAX_PROJECT_BYTES, read_project, write_atomic};
