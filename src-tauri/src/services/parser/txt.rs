//! Plain text document parser.
//!
//! Parses plain text (.txt) files into segments.

use std::fs;
use std::path::Path;

use super::{ParseError, ParsedBook, Segment};

/// Parse a plain text file into a ParsedBook.
///
/// Reads the file as UTF-8 and splits content into segments at double
/// newlines (blank lines). No HTML is generated for plain text segments.
///
/// # Arguments
/// * `path` - Path to the text file
///
/// # Returns
/// * `Ok(ParsedBook)` - Successfully parsed book
/// * `Err(ParseError)` - If the file cannot be read
pub fn parse_txt(path: &Path) -> Result<ParsedBook, ParseError> {
    let content = fs::read_to_string(path)?;

    // Title from filename (without extension)
    let title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();

    // Split into segments at double newlines
    let segments = parse_content_to_segments(&content);

    Ok(ParsedBook {
        title,
        author: None, // Plain text files don't have author metadata
        segments,
    })
}

/// Parse plain text content into segments.
///
/// Segments are separated by double newlines (blank lines).
/// Each segment's content is the plain text with whitespace normalized.
fn parse_content_to_segments(content: &str) -> Vec<Segment> {
    let mut segments = Vec::new();
    let mut segment_index: u32 = 0;

    // Normalize line endings and split on double newlines
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");

    // Split on double (or more) newlines
    for block in normalized.split("\n\n") {
        let trimmed = block.trim();

        // Skip empty blocks
        if trimmed.is_empty() {
            continue;
        }

        // Normalize internal whitespace (collapse multiple spaces, convert newlines to spaces)
        let normalized_text = normalize_whitespace(trimmed);

        if !normalized_text.is_empty() {
            segments.push(Segment::new(
                segment_index,
                normalized_text,
                None, // No HTML for plain text
            ));
            segment_index += 1;
        }
    }

    segments
}

/// Normalize whitespace in a text block.
///
/// - Converts single newlines to spaces (soft wrapping)
/// - Collapses multiple spaces into one
/// - Trims leading/trailing whitespace
fn normalize_whitespace(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_whitespace() {
        assert_eq!(normalize_whitespace("hello  world"), "hello world");
        assert_eq!(normalize_whitespace("line1\nline2"), "line1 line2");
        assert_eq!(normalize_whitespace("  spaced  "), "spaced");
        assert_eq!(normalize_whitespace("a\n\n\nb"), "a b");
    }

    #[test]
    fn test_parse_content_to_segments() {
        let content = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph.";
        let segments = parse_content_to_segments(content);

        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0].content, "First paragraph here.");
        assert_eq!(segments[0].index, 0);
        assert!(segments[0].id.starts_with("seg_"));
        assert_eq!(segments[0].html, None);

        assert_eq!(segments[1].content, "Second paragraph here.");
        assert_eq!(segments[1].index, 1);

        assert_eq!(segments[2].content, "Third paragraph.");
        assert_eq!(segments[2].index, 2);
    }

    #[test]
    fn test_empty_blocks_skipped() {
        let content = "First.\n\n\n\n\nSecond.";
        let segments = parse_content_to_segments(content);

        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0].content, "First.");
        assert_eq!(segments[1].content, "Second.");
    }

    #[test]
    fn test_windows_line_endings() {
        let content = "First.\r\n\r\nSecond.\r\n\r\nThird.";
        let segments = parse_content_to_segments(content);

        assert_eq!(segments.len(), 3);
    }

    #[test]
    fn test_soft_wrap_preserved() {
        let content = "This is a long\nparagraph that wraps\nacross multiple lines.\n\nSecond paragraph.";
        let segments = parse_content_to_segments(content);

        assert_eq!(segments.len(), 2);
        assert_eq!(
            segments[0].content,
            "This is a long paragraph that wraps across multiple lines."
        );
    }
}
