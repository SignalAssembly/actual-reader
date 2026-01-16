//! Book model - a single piece of content imported by the user.

use serde::{Deserialize, Serialize};

/// Unique identifier for a Book (UUID v4).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct BookId(pub String);

impl BookId {
    /// Create a new BookId from a string.
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    /// Get the inner string value.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for BookId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Format of the original source file.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SourceFormat {
    Epub,
    Markdown,
    Txt,
    Pdf,
}

impl SourceFormat {
    /// Convert to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Epub => "epub",
            Self::Markdown => "markdown",
            Self::Txt => "txt",
            Self::Pdf => "pdf",
        }
    }

    /// Parse from database string representation.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "epub" => Some(Self::Epub),
            "markdown" => Some(Self::Markdown),
            "txt" => Some(Self::Txt),
            "pdf" => Some(Self::Pdf),
            _ => None,
        }
    }
}

/// Status of narration generation for a book.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NarrationStatus {
    None,
    Generating,
    Ready,
}

impl NarrationStatus {
    /// Convert to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Generating => "generating",
            Self::Ready => "ready",
        }
    }

    /// Parse from database string representation.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "none" => Some(Self::None),
            "generating" => Some(Self::Generating),
            "ready" => Some(Self::Ready),
            _ => None,
        }
    }
}

/// A book in the library.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: BookId,
    pub title: String,
    pub author: Option<String>,
    pub source_format: SourceFormat,
    pub source_path: String,
    pub narration_status: NarrationStatus,
    pub narration_path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    /// None if the book has never been opened (for "Recent" section).
    pub last_opened_at: Option<i64>,
}
