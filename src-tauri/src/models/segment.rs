//! Segment model - a single unit of text with corresponding narration timing.

use serde::{Deserialize, Serialize};

use super::BookId;

/// Unique identifier for a Segment (prefixed with "seg_" + UUID v4).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SegmentId(pub String);

impl SegmentId {
    /// Create a new SegmentId from a string.
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    /// Get the inner string value.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for SegmentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A text segment within a book.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: SegmentId,
    pub book_id: BookId,
    /// 0-based position within the book.
    pub index: u32,
    /// Plain text content.
    pub content: String,
    /// Optional HTML rendering.
    pub html: Option<String>,
}
