//! TTS service for generating narration using Chatterbox.
//!
//! This service handles communication with the Chatterbox TTS server
//! and provides utilities for audio generation and manipulation.

use reqwest::Client;
use serde::Serialize;
use thiserror::Error;

/// Default Chatterbox server URL.
pub const CHATTERBOX_URL: &str = "http://localhost:60001";

/// Errors that can occur during TTS operations.
#[derive(Debug, Error)]
pub enum TtsError {
    #[error("Chatterbox server unavailable: {0}")]
    ServerUnavailable(String),

    #[error("TTS generation failed: {0}")]
    GenerationFailed(String),

    #[error("Invalid audio data: {0}")]
    InvalidAudio(String),

    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Audio concatenation failed: {0}")]
    ConcatenationError(String),
}

/// Request body for Chatterbox TTS generation.
#[derive(Debug, Serialize)]
pub struct ChatterboxRequest {
    pub text: String,
    pub voice: String,
    pub exag: f32,
    pub cfg: f32,
    pub temp: f32,
}

/// TTS service for generating narration using Chatterbox.
#[derive(Debug, Clone)]
pub struct TtsService {
    client: Client,
    base_url: String,
}

impl Default for TtsService {
    fn default() -> Self {
        Self::new()
    }
}

impl TtsService {
    /// Create a new TTS service with default settings.
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            base_url: CHATTERBOX_URL.to_string(),
        }
    }

    /// Create a new TTS service with a custom server URL.
    pub fn with_url(url: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: url.into(),
        }
    }

    /// Check if the Chatterbox server is available.
    pub async fn is_available(&self) -> bool {
        match self.client.get(&self.base_url).send().await {
            Ok(response) => response.status().is_success() || response.status().as_u16() == 404,
            Err(_) => false,
        }
    }

    /// Generate audio for the given text using Chatterbox.
    ///
    /// # Arguments
    /// * `text` - The text to convert to speech
    /// * `voice_sample` - Path/name of the voice sample file (e.g., "voice-name.wav")
    /// * `exag` - Exaggeration parameter (default: 0.3)
    /// * `cfg` - CFG parameter (default: 0.5)
    /// * `temp` - Temperature parameter (default: 0.8)
    ///
    /// # Returns
    /// WAV audio data as bytes
    pub async fn generate_audio(
        &self,
        text: &str,
        voice_sample: &str,
        exag: f32,
        cfg: f32,
        temp: f32,
    ) -> Result<Vec<u8>, TtsError> {
        let request = ChatterboxRequest {
            text: text.to_string(),
            voice: voice_sample.to_string(),
            exag,
            cfg,
            temp,
        };

        let url = format!("{}/generate", self.base_url);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() {
                    TtsError::ServerUnavailable(format!(
                        "Cannot connect to Chatterbox server at {}",
                        self.base_url
                    ))
                } else {
                    TtsError::HttpError(e)
                }
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(TtsError::GenerationFailed(format!(
                "Server returned {}: {}",
                status, body
            )));
        }

        let audio_data = response.bytes().await?.to_vec();

        if audio_data.len() < 44 {
            return Err(TtsError::InvalidAudio(
                "Response too small to be valid WAV audio".to_string(),
            ));
        }

        // Basic WAV header validation
        if &audio_data[0..4] != b"RIFF" || &audio_data[8..12] != b"WAVE" {
            return Err(TtsError::InvalidAudio(
                "Response is not valid WAV audio".to_string(),
            ));
        }

        Ok(audio_data)
    }

    /// Concatenate multiple WAV audio segments into a single WAV file.
    ///
    /// # Arguments
    /// * `segments` - Vector of WAV audio data
    ///
    /// # Returns
    /// Concatenated WAV audio data
    pub fn concatenate_audio(&self, segments: Vec<Vec<u8>>) -> Result<Vec<u8>, TtsError> {
        if segments.is_empty() {
            return Err(TtsError::ConcatenationError(
                "No audio segments provided".to_string(),
            ));
        }

        if segments.len() == 1 {
            return Ok(segments.into_iter().next().unwrap());
        }

        // Parse the first WAV to get format info
        let first_wav = &segments[0];
        let wav_info = parse_wav_header(first_wav)?;

        // Collect all audio data chunks
        let mut all_audio_data: Vec<u8> = Vec::new();

        for (i, segment) in segments.iter().enumerate() {
            let segment_info = parse_wav_header(segment).map_err(|e| {
                TtsError::ConcatenationError(format!("Invalid WAV in segment {}: {}", i, e))
            })?;

            // Verify format compatibility
            if segment_info.channels != wav_info.channels
                || segment_info.sample_rate != wav_info.sample_rate
                || segment_info.bits_per_sample != wav_info.bits_per_sample
            {
                return Err(TtsError::ConcatenationError(format!(
                    "Audio format mismatch in segment {}: expected {}ch/{}Hz/{}bit, got {}ch/{}Hz/{}bit",
                    i,
                    wav_info.channels, wav_info.sample_rate, wav_info.bits_per_sample,
                    segment_info.channels, segment_info.sample_rate, segment_info.bits_per_sample
                )));
            }

            // Extract audio data (skip header)
            all_audio_data.extend_from_slice(&segment[segment_info.data_offset..]);
        }

        // Build the concatenated WAV file
        let result = build_wav_file(&wav_info, &all_audio_data)?;

        Ok(result)
    }
}

/// WAV format information.
#[derive(Debug, Clone)]
struct WavInfo {
    channels: u16,
    sample_rate: u32,
    bits_per_sample: u16,
    audio_format: u16,
    data_offset: usize,
}

/// Parse WAV header and extract format information.
fn parse_wav_header(data: &[u8]) -> Result<WavInfo, TtsError> {
    if data.len() < 44 {
        return Err(TtsError::InvalidAudio("WAV file too small".to_string()));
    }

    // Verify RIFF header
    if &data[0..4] != b"RIFF" {
        return Err(TtsError::InvalidAudio("Missing RIFF header".to_string()));
    }

    // Verify WAVE format
    if &data[8..12] != b"WAVE" {
        return Err(TtsError::InvalidAudio("Missing WAVE format".to_string()));
    }

    // Find fmt chunk
    let mut offset = 12;
    let mut fmt_found = false;
    let mut audio_format: u16 = 0;
    let mut channels: u16 = 0;
    let mut sample_rate: u32 = 0;
    let mut bits_per_sample: u16 = 0;

    while offset + 8 <= data.len() {
        let chunk_id = &data[offset..offset + 4];
        let chunk_size = u32::from_le_bytes([
            data[offset + 4],
            data[offset + 5],
            data[offset + 6],
            data[offset + 7],
        ]) as usize;

        if chunk_id == b"fmt " {
            if offset + 8 + 16 > data.len() {
                return Err(TtsError::InvalidAudio("fmt chunk too small".to_string()));
            }

            audio_format = u16::from_le_bytes([data[offset + 8], data[offset + 9]]);
            channels = u16::from_le_bytes([data[offset + 10], data[offset + 11]]);
            sample_rate = u32::from_le_bytes([
                data[offset + 12],
                data[offset + 13],
                data[offset + 14],
                data[offset + 15],
            ]);
            // byte_rate at offset + 16..20
            // block_align at offset + 20..22
            bits_per_sample = u16::from_le_bytes([data[offset + 22], data[offset + 23]]);

            fmt_found = true;
            offset += 8 + chunk_size;
            // Align to 2 bytes
            if chunk_size % 2 != 0 {
                offset += 1;
            }
        } else if chunk_id == b"data" {
            if !fmt_found {
                return Err(TtsError::InvalidAudio(
                    "data chunk before fmt chunk".to_string(),
                ));
            }

            return Ok(WavInfo {
                channels,
                sample_rate,
                bits_per_sample,
                audio_format,
                data_offset: offset + 8,
            });
        } else {
            // Skip unknown chunk
            offset += 8 + chunk_size;
            if chunk_size % 2 != 0 {
                offset += 1;
            }
        }
    }

    Err(TtsError::InvalidAudio(
        "Could not find data chunk".to_string(),
    ))
}

/// Build a WAV file from format info and audio data.
fn build_wav_file(info: &WavInfo, audio_data: &[u8]) -> Result<Vec<u8>, TtsError> {
    let byte_rate = info.sample_rate * info.channels as u32 * info.bits_per_sample as u32 / 8;
    let block_align = info.channels * info.bits_per_sample / 8;
    let data_size = audio_data.len() as u32;
    let file_size = 36 + data_size; // RIFF size = file size - 8

    let mut output = Vec::with_capacity(44 + audio_data.len());

    // RIFF header
    output.extend_from_slice(b"RIFF");
    output.extend_from_slice(&file_size.to_le_bytes());
    output.extend_from_slice(b"WAVE");

    // fmt chunk
    output.extend_from_slice(b"fmt ");
    output.extend_from_slice(&16u32.to_le_bytes()); // chunk size
    output.extend_from_slice(&info.audio_format.to_le_bytes());
    output.extend_from_slice(&info.channels.to_le_bytes());
    output.extend_from_slice(&info.sample_rate.to_le_bytes());
    output.extend_from_slice(&byte_rate.to_le_bytes());
    output.extend_from_slice(&block_align.to_le_bytes());
    output.extend_from_slice(&info.bits_per_sample.to_le_bytes());

    // data chunk
    output.extend_from_slice(b"data");
    output.extend_from_slice(&data_size.to_le_bytes());
    output.extend_from_slice(audio_data);

    Ok(output)
}

/// Get the duration of WAV audio data in seconds.
pub fn get_wav_duration(data: &[u8]) -> Result<f64, TtsError> {
    let info = parse_wav_header(data)?;
    let data_size = data.len() - info.data_offset;
    let bytes_per_sample = info.bits_per_sample as usize / 8;
    let samples = data_size / (info.channels as usize * bytes_per_sample);
    Ok(samples as f64 / info.sample_rate as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_wav(duration_samples: usize, sample_rate: u32, channels: u16) -> Vec<u8> {
        let bits_per_sample: u16 = 16;
        let byte_rate = sample_rate * channels as u32 * bits_per_sample as u32 / 8;
        let block_align = channels * bits_per_sample / 8;
        let data_size = (duration_samples * channels as usize * 2) as u32;
        let file_size = 36 + data_size;

        let mut wav = Vec::new();

        // RIFF header
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&file_size.to_le_bytes());
        wav.extend_from_slice(b"WAVE");

        // fmt chunk
        wav.extend_from_slice(b"fmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
        wav.extend_from_slice(&channels.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&byte_rate.to_le_bytes());
        wav.extend_from_slice(&block_align.to_le_bytes());
        wav.extend_from_slice(&bits_per_sample.to_le_bytes());

        // data chunk
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_size.to_le_bytes());

        // Audio data (silence)
        for _ in 0..(duration_samples * channels as usize) {
            wav.extend_from_slice(&0i16.to_le_bytes());
        }

        wav
    }

    #[test]
    fn test_parse_wav_header() {
        let wav = create_test_wav(1000, 44100, 2);
        let info = parse_wav_header(&wav).unwrap();

        assert_eq!(info.channels, 2);
        assert_eq!(info.sample_rate, 44100);
        assert_eq!(info.bits_per_sample, 16);
        assert_eq!(info.audio_format, 1); // PCM
    }

    #[test]
    fn test_get_wav_duration() {
        let wav = create_test_wav(44100, 44100, 1); // 1 second of audio
        let duration = get_wav_duration(&wav).unwrap();
        assert!((duration - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_concatenate_audio() {
        let service = TtsService::new();

        let wav1 = create_test_wav(22050, 44100, 1); // 0.5 seconds
        let wav2 = create_test_wav(22050, 44100, 1); // 0.5 seconds

        let combined = service.concatenate_audio(vec![wav1, wav2]).unwrap();
        let duration = get_wav_duration(&combined).unwrap();

        assert!((duration - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_concatenate_mismatched_formats() {
        let service = TtsService::new();

        let wav1 = create_test_wav(1000, 44100, 1);
        let wav2 = create_test_wav(1000, 22050, 1); // Different sample rate

        let result = service.concatenate_audio(vec![wav1, wav2]);
        assert!(result.is_err());
    }
}
