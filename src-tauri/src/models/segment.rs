//! Segment model - a single unit of content (text or image) with corresponding narration timing.

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

/// Type of segment - either text content or an image.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SegmentType {
    Text,
    Image,
}

impl Default for SegmentType {
    fn default() -> Self {
        Self::Text
    }
}

/// Position of an image on the page.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ImagePosition {
    Top,
    Middle,
    Bottom,
    FullPage,
    Inline,
}

impl Default for ImagePosition {
    fn default() -> Self {
        Self::Middle
    }
}

/// Data for an image segment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageData {
    /// Path to the image file.
    pub source_path: String,
    /// AI-generated caption for narration.
    pub caption: Option<String>,
    /// Original alt text from the source document.
    pub alt_text: Option<String>,
    /// Page number if available.
    pub page_number: Option<u32>,
    /// Position of the image on the page.
    pub position: ImagePosition,
}

/// A content segment within a book (text or image).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: SegmentId,
    pub book_id: BookId,
    /// 0-based position within the book.
    pub index: u32,
    /// Plain text content (or image caption for image segments).
    pub content: String,
    /// Optional HTML rendering.
    pub html: Option<String>,
    /// Type of segment.
    #[serde(default)]
    pub segment_type: SegmentType,
    /// Image data (only for image segments).
    pub image_data: Option<ImageData>,
}
