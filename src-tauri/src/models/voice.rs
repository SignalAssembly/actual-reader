//! Voice model - a TTS voice profile used to generate narration.
//!
//! Actual Reader uses Chatterbox exclusively for TTS generation.

use serde::{Deserialize, Serialize};

/// Unique identifier for a Voice (prefixed with "voice_" + UUID v4).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct VoiceId(pub String);

impl VoiceId {
    /// Create a new VoiceId from a string.
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    /// Get the inner string value.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for VoiceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A voice profile for narration generation (Chatterbox voice cloning).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Voice {
    pub id: VoiceId,
    pub name: String,
    /// Path to voice sample for cloning.
    pub sample_path: String,
    pub is_default: bool,
}
