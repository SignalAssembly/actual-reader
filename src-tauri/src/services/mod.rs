//! Backend services for Actual Reader.
//!
//! This module contains the core business logic services:
//! - `parser` - Document parsing (EPUB, Markdown, TXT)
//! - `tts` - Text-to-speech generation using Chatterbox
//! - `vision` - Image captioning using Qwen2.5-VL

pub mod parser;
pub mod tts;
pub mod vision;
