//! Storage layer for Actual Reader.
//!
//! Handles SQLite database and file system operations.

mod db;
mod files;

pub use db::{init_database, Database};
pub use files::{get_bundles_dir, get_narration_dir, get_sources_dir, AppPaths};
