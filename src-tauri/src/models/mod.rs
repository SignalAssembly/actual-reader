//! Data models for Actual Reader.
//!
//! All types follow the exact definitions from SCHEMAS.md.

mod book;
mod marker;
mod progress;
mod segment;
mod voice;

pub use book::{Book, BookId, NarrationStatus, SourceFormat};
pub use marker::Marker;
pub use progress::Progress;
pub use segment::{Segment, SegmentId};
pub use voice::{Voice, VoiceId};
