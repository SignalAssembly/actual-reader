//! EPUB document parser.
//!
//! Parses EPUB files and extracts text content into segments.

use std::path::Path;
use epub::doc::EpubDoc;

use super::{ParseError, ParsedBook, Segment};

/// Parse an EPUB file into a ParsedBook.
///
/// Extracts title and author from EPUB metadata, then iterates through
/// the spine (reading order) to extract text content from each chapter.
/// Content is split into segments at paragraph and heading boundaries.
///
/// # Arguments
/// * `path` - Path to the EPUB file
///
/// # Returns
/// * `Ok(ParsedBook)` - Successfully parsed book
/// * `Err(ParseError)` - If the EPUB cannot be read or parsed
pub fn parse_epub(path: &Path) -> Result<ParsedBook, ParseError> {
    let mut doc = EpubDoc::new(path)
        .map_err(|e| ParseError::EpubError(e.to_string()))?;

    // Extract metadata - use get_title() helper or fall back to filename
    let title = doc
        .get_title()
        .unwrap_or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled")
                .to_string()
        });

    // Extract author from creator or author metadata
    let author = doc
        .mdata("creator")
        .or_else(|| doc.mdata("author"))
        .map(|item| item.value.clone());

    // Extract content from all spine items (chapters in reading order)
    let mut segments = Vec::new();
    let mut segment_index: u32 = 0;

    let num_chapters = doc.get_num_chapters();

    for chapter_num in 0..num_chapters {
        doc.set_current_chapter(chapter_num);

        // get_current_str returns Option<(content_string, mime_type)>
        if let Some((content, _mime)) = doc.get_current_str() {
            // Parse HTML content and extract text segments
            let chapter_segments = extract_segments_from_html(&content, &mut segment_index);
            segments.extend(chapter_segments);
        }
    }

    Ok(ParsedBook {
        title,
        author,
        segments,
    })
}

/// Extract segments from HTML content.
///
/// Parses the HTML and creates a segment for each paragraph (`<p>`) or
/// heading (`<h1>` - `<h6>`) element. Preserves the original HTML in
/// the segment's html field.
fn extract_segments_from_html(html: &str, start_index: &mut u32) -> Vec<Segment> {
    let mut segments = Vec::new();

    // Simple HTML parsing - extract text between paragraph and heading tags
    // We use a basic approach that handles common EPUB HTML structures

    let mut remaining = html;

    while !remaining.is_empty() {
        // Find the next segment-worthy element (p, h1-h6)
        if let Some(segment_result) = find_next_segment(remaining) {
            let (text_content, html_content, rest) = segment_result;

            // Skip empty segments
            let trimmed = text_content.trim();
            if !trimmed.is_empty() {
                segments.push(Segment::new(
                    *start_index,
                    trimmed.to_string(),
                    Some(html_content),
                ));
                *start_index += 1;
            }

            remaining = rest;
        } else {
            break;
        }
    }

    segments
}

/// Find the next paragraph or heading element in HTML.
///
/// Returns (plain_text, html_element, remaining_html) or None if no more elements.
fn find_next_segment(html: &str) -> Option<(String, String, &str)> {
    // Tags that represent segments
    let segment_tags = ["p", "h1", "h2", "h3", "h4", "h5", "h6"];

    let mut earliest_match: Option<(usize, &str)> = None;

    for tag in &segment_tags {
        let open_tag = format!("<{}", tag);
        if let Some(pos) = html.find(&open_tag) {
            if earliest_match.is_none() || pos < earliest_match.unwrap().0 {
                earliest_match = Some((pos, tag));
            }
        }
    }

    let (start_pos, tag) = earliest_match?;

    // Find the end of the opening tag (handle attributes)
    let after_open = &html[start_pos..];
    let tag_end = after_open.find('>')?;

    // Find closing tag
    let close_tag = format!("</{}>", tag);
    let content_start = start_pos + tag_end + 1;

    // Search for closing tag from content_start
    let after_content = &html[content_start..];
    let close_pos = after_content.find(&close_tag)?;

    let inner_html = &html[content_start..content_start + close_pos];
    let full_element_end = content_start + close_pos + close_tag.len();

    // Extract plain text (strip inner HTML tags)
    let plain_text = strip_html_tags(inner_html);

    // Build the full HTML element
    let full_html = html[start_pos..full_element_end].to_string();

    Some((plain_text, full_html, &html[full_element_end..]))
}

/// Strip HTML tags from a string, returning plain text.
fn strip_html_tags(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut chars = html.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '<' => {
                in_tag = true;
            }
            '>' => {
                in_tag = false;
            }
            '&' if !in_tag => {
                // Handle common HTML entities
                let mut entity = String::new();
                while let Some(&next_c) = chars.peek() {
                    if next_c == ';' {
                        chars.next();
                        break;
                    }
                    entity.push(chars.next().unwrap());
                }

                let decoded = match entity.as_str() {
                    "amp" => "&",
                    "lt" => "<",
                    "gt" => ">",
                    "quot" => "\"",
                    "apos" => "'",
                    "nbsp" => " ",
                    "#39" => "'",
                    "#34" => "\"",
                    _ if entity.starts_with('#') => {
                        // Numeric entity - try to decode
                        if let Some(code) = entity[1..].parse::<u32>().ok() {
                            if let Some(ch) = char::from_u32(code) {
                                result.push(ch);
                                continue;
                            }
                        }
                        ""
                    }
                    _ => "",
                };
                result.push_str(decoded);
            }
            _ if !in_tag => {
                result.push(c);
            }
            _ => {}
        }
    }

    // Normalize whitespace
    let normalized: String = result
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    normalized
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_html_tags() {
        assert_eq!(strip_html_tags("<p>Hello world</p>"), "Hello world");
        assert_eq!(strip_html_tags("<b>Bold</b> text"), "Bold text");
        assert_eq!(strip_html_tags("No tags"), "No tags");
        assert_eq!(strip_html_tags("<p>One &amp; two</p>"), "One & two");
        assert_eq!(strip_html_tags("<p>&lt;code&gt;</p>"), "<code>");
    }

    #[test]
    fn test_find_next_segment() {
        let html = "<p>First paragraph</p><p>Second paragraph</p>";

        let (text, element, rest) = find_next_segment(html).unwrap();
        assert_eq!(text, "First paragraph");
        assert_eq!(element, "<p>First paragraph</p>");

        let (text2, element2, _) = find_next_segment(rest).unwrap();
        assert_eq!(text2, "Second paragraph");
        assert_eq!(element2, "<p>Second paragraph</p>");
    }

    #[test]
    fn test_extract_segments_headings() {
        let html = "<h1>Chapter One</h1><p>Some text here.</p>";
        let mut index = 0;
        let segments = extract_segments_from_html(html, &mut index);

        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0].content, "Chapter One");
        assert_eq!(segments[0].index, 0);
        assert_eq!(segments[1].content, "Some text here.");
        assert_eq!(segments[1].index, 1);
    }
}
