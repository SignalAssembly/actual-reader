//! Document parsing services for Actual Reader.
//!
//! This module handles parsing various document formats (EPUB, Markdown, TXT)
//! into a unified ParsedBook structure with segments.

pub mod epub;
pub mod markdown;
pub mod txt;

use std::path::Path;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// Errors that can occur during parsing
#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Failed to read file: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Unsupported file format: {0}")]
    UnsupportedFormat(String),

    #[error("Failed to parse EPUB: {0}")]
    EpubError(String),

    #[error("Invalid UTF-8 encoding")]
    Utf8Error(#[from] std::string::FromUtf8Error),

    #[error("Parse error: {0}")]
    ParseError(String),
}

/// A segment of text content within a book.
/// Each segment corresponds to a paragraph, heading, or other logical unit.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    /// Unique identifier for this segment (format: "seg_" + UUID)
    pub id: String,
    /// 0-based position index within the book
    pub index: u32,
    /// Plain text content
    pub content: String,
    /// Optional HTML rendering of the content
    pub html: Option<String>,
}

impl Segment {
    /// Create a new segment with a generated UUID
    pub fn new(index: u32, content: String, html: Option<String>) -> Self {
        Self {
            id: format!("seg_{}", Uuid::new_v4()),
            index,
            content,
            html,
        }
    }
}

/// Represents a fully parsed book ready for storage
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedBook {
    /// Book title extracted from metadata or filename
    pub title: String,
    /// Author name if available
    pub author: Option<String>,
    /// All text segments in reading order
    pub segments: Vec<Segment>,
}

/// Supported source formats for parsing
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceFormat {
    Epub,
    Markdown,
    Txt,
}

impl SourceFormat {
    /// Detect format from file extension
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_lowercase().as_str() {
            "epub" => Some(Self::Epub),
            "md" | "markdown" => Some(Self::Markdown),
            "txt" | "text" => Some(Self::Txt),
            _ => None,
        }
    }
}

/// Parse a file at the given path into a ParsedBook.
///
/// The format is auto-detected from the file extension.
///
/// # Arguments
/// * `path` - Path to the source file
///
/// # Returns
/// * `Ok(ParsedBook)` - Successfully parsed book with segments
/// * `Err(ParseError)` - If the file cannot be read or parsed
///
/// # Example
/// ```no_run
/// use std::path::Path;
/// use actual_reader_lib::services::parser::parse_file;
///
/// let book = parse_file(Path::new("book.epub"))?;
/// println!("Parsed {} segments from {}", book.segments.len(), book.title);
/// ```
pub fn parse_file(path: &Path) -> Result<ParsedBook, ParseError> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or_else(|| ParseError::UnsupportedFormat("No file extension".to_string()))?;

    let format = SourceFormat::from_extension(extension)
        .ok_or_else(|| ParseError::UnsupportedFormat(extension.to_string()))?;

    match format {
        SourceFormat::Epub => epub::parse_epub(path),
        SourceFormat::Markdown => markdown::parse_markdown(path),
        SourceFormat::Txt => txt::parse_txt(path),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_segment_new() {
        let segment = Segment::new(0, "Hello world".to_string(), Some("<p>Hello world</p>".to_string()));
        assert!(segment.id.starts_with("seg_"));
        assert_eq!(segment.index, 0);
        assert_eq!(segment.content, "Hello world");
        assert_eq!(segment.html, Some("<p>Hello world</p>".to_string()));
    }

    #[test]
    fn test_source_format_from_extension() {
        assert_eq!(SourceFormat::from_extension("epub"), Some(SourceFormat::Epub));
        assert_eq!(SourceFormat::from_extension("EPUB"), Some(SourceFormat::Epub));
        assert_eq!(SourceFormat::from_extension("md"), Some(SourceFormat::Markdown));
        assert_eq!(SourceFormat::from_extension("markdown"), Some(SourceFormat::Markdown));
        assert_eq!(SourceFormat::from_extension("txt"), Some(SourceFormat::Txt));
        assert_eq!(SourceFormat::from_extension("text"), Some(SourceFormat::Txt));
        assert_eq!(SourceFormat::from_extension("pdf"), None);
        assert_eq!(SourceFormat::from_extension("doc"), None);
    }
}
