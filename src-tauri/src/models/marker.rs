//! Marker model - a timestamp pointing to a position in narration.

use serde::{Deserialize, Serialize};

use super::SegmentId;

/// A timing marker linking a segment to its position in the narration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Marker {
    pub segment_id: SegmentId,
    /// Start time in narration (seconds).
    pub start: f64,
    /// End time in narration (seconds).
    pub end: f64,
}
