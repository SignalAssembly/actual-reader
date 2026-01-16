//! Progress model - how far through a book the user has read/listened.

use serde::{Deserialize, Serialize};

use super::BookId;

/// Reading/listening progress for a book.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub book_id: BookId,
    /// Current segment index (0-based).
    pub segment_index: u32,
    /// Position in narration (seconds), None if no narration.
    pub audio_time: Option<f64>,
    pub updated_at: i64,
}
