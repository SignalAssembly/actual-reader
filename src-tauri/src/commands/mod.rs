//! Tauri command handlers for Actual Reader.
//!
//! This module contains all IPC command handlers that bridge the frontend
//! to backend services. Commands follow the interface defined in ARCHITECTURE.md.

mod bundle;
mod library;
mod reader;
mod settings;
mod sync;
mod tts;

pub use bundle::*;
pub use library::*;
pub use reader::*;
pub use settings::*;
pub use sync::*;
pub use tts::*;
