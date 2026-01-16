//! Markdown document parser.
//!
//! Parses Markdown files using pulldown-cmark and extracts text into segments.

use std::fs;
use std::path::Path;
use pulldown_cmark::{Parser, Options, Event, Tag, TagEnd, html};

use super::{ParseError, ParsedBook, Segment};

/// Parse a Markdown file into a ParsedBook.
///
/// Uses pulldown-cmark to parse the Markdown content. Segments are created
/// for each block-level element (paragraphs, headings, etc.). The title
/// is extracted from the first H1 heading if present.
///
/// # Arguments
/// * `path` - Path to the Markdown file
///
/// # Returns
/// * `Ok(ParsedBook)` - Successfully parsed book
/// * `Err(ParseError)` - If the file cannot be read or parsed
pub fn parse_markdown(path: &Path) -> Result<ParsedBook, ParseError> {
    let content = fs::read_to_string(path)?;

    // Extract title from first H1, or use filename
    let title = extract_title(&content).unwrap_or_else(|| {
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string()
    });

    // Parse into segments
    let segments = parse_content_to_segments(&content);

    Ok(ParsedBook {
        title,
        author: None, // Markdown files don't have author metadata
        segments,
    })
}

/// Extract the title from the first H1 heading in Markdown content.
fn extract_title(content: &str) -> Option<String> {
    let parser = Parser::new_ext(content, Options::all());
    let mut in_h1 = false;
    let mut title = String::new();

    for event in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) if level == pulldown_cmark::HeadingLevel::H1 => {
                in_h1 = true;
            }
            Event::Text(text) if in_h1 => {
                title.push_str(&text);
            }
            Event::End(TagEnd::Heading(level)) if level == pulldown_cmark::HeadingLevel::H1 => {
                if !title.is_empty() {
                    return Some(title);
                }
                in_h1 = false;
            }
            _ => {}
        }
    }

    None
}

/// Parse Markdown content into segments.
///
/// Creates a segment for each block-level element. Blank lines separate
/// logical segments in the source.
fn parse_content_to_segments(content: &str) -> Vec<Segment> {
    let mut segments = Vec::new();
    let mut segment_index: u32 = 0;

    // Split content into blocks (separated by blank lines)
    let blocks = split_into_blocks(content);

    for block in blocks {
        let trimmed = block.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Parse this block to get plain text and HTML
        let (plain_text, html_content) = parse_block(trimmed);

        if !plain_text.is_empty() {
            segments.push(Segment::new(
                segment_index,
                plain_text,
                Some(html_content),
            ));
            segment_index += 1;
        }
    }

    segments
}

/// Split Markdown content into blocks separated by blank lines.
fn split_into_blocks(content: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut current_block = String::new();
    let mut in_code_block = false;

    for line in content.lines() {
        // Track code blocks (don't split inside them)
        if line.trim().starts_with("```") {
            in_code_block = !in_code_block;
            current_block.push_str(line);
            current_block.push('\n');
            continue;
        }

        if in_code_block {
            current_block.push_str(line);
            current_block.push('\n');
            continue;
        }

        // Blank line separates blocks (unless in code block)
        if line.trim().is_empty() {
            if !current_block.trim().is_empty() {
                blocks.push(current_block.clone());
                current_block.clear();
            }
        } else {
            current_block.push_str(line);
            current_block.push('\n');
        }
    }

    // Don't forget the last block
    if !current_block.trim().is_empty() {
        blocks.push(current_block);
    }

    blocks
}

/// Parse a single Markdown block into plain text and HTML.
fn parse_block(markdown: &str) -> (String, String) {
    let parser = Parser::new_ext(markdown, Options::all());

    // Collect events for both text extraction and HTML rendering
    let events: Vec<Event> = parser.collect();

    // Extract plain text
    let plain_text = extract_plain_text(&events);

    // Render to HTML
    let mut html_output = String::new();
    html::push_html(&mut html_output, events.into_iter());

    (plain_text.trim().to_string(), html_output.trim().to_string())
}

/// Extract plain text from pulldown-cmark events.
fn extract_plain_text(events: &[Event]) -> String {
    let mut text = String::new();

    for event in events {
        match event {
            Event::Text(t) => text.push_str(t),
            Event::Code(c) => text.push_str(c),
            Event::SoftBreak | Event::HardBreak => text.push(' '),
            _ => {}
        }
    }

    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_title() {
        let content = "# My Book Title\n\nSome content here.";
        assert_eq!(extract_title(content), Some("My Book Title".to_string()));

        let content_no_h1 = "## Chapter 1\n\nSome content.";
        assert_eq!(extract_title(content_no_h1), None);
    }

    #[test]
    fn test_parse_block() {
        let (text, html) = parse_block("Hello **world**");
        assert_eq!(text, "Hello world");
        assert_eq!(html, "<p>Hello <strong>world</strong></p>");
    }

    #[test]
    fn test_parse_heading() {
        let (text, html) = parse_block("## Chapter One");
        assert_eq!(text, "Chapter One");
        assert!(html.contains("<h2>"));
    }

    #[test]
    fn test_split_into_blocks() {
        let content = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
        let blocks = split_into_blocks(content);
        assert_eq!(blocks.len(), 3);
    }

    #[test]
    fn test_code_blocks_not_split() {
        let content = "Before code.\n\n```rust\nfn main() {\n\n}\n```\n\nAfter code.";
        let blocks = split_into_blocks(content);
        // Should be 3 blocks: paragraph, code block, paragraph
        assert_eq!(blocks.len(), 3);
        assert!(blocks[1].contains("fn main()"));
    }

    #[test]
    fn test_parse_content_to_segments() {
        let content = "# Title\n\nFirst paragraph.\n\nSecond paragraph.";
        let segments = parse_content_to_segments(content);

        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0].content, "Title");
        assert_eq!(segments[0].index, 0);
        assert_eq!(segments[1].content, "First paragraph.");
        assert_eq!(segments[1].index, 1);
        assert_eq!(segments[2].content, "Second paragraph.");
        assert_eq!(segments[2].index, 2);
    }
}
