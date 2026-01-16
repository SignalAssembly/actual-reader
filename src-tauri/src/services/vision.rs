//! Vision service for image captioning using Qwen2.5-VL.
//!
//! This module provides a thin HTTP client wrapper for communicating with
//! a local Qwen2.5-VL model server. It's used during narration generation
//! to generate captions for image segments in ebooks.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Default endpoint for the vision service
const DEFAULT_ENDPOINT: &str = "http://localhost:60003";

/// Errors that can occur during vision operations
#[derive(Error, Debug)]
pub enum VisionError {
    #[error("Vision service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Failed to process image: {0}")]
    ProcessingError(String),

    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),
}

/// Request payload for image captioning
#[derive(Debug, Serialize)]
struct CaptionRequest {
    /// Base64-encoded image data
    image_base64: String,
    /// Optional prompt to guide caption generation
    prompt: Option<String>,
}

/// Response from the captioning endpoint
#[derive(Debug, Deserialize)]
struct CaptionResponse {
    /// Generated caption text
    caption: String,
}

/// Vision service client for image captioning.
///
/// This service communicates with a local Qwen2.5-VL model server
/// to generate text descriptions of images for audiobook listeners.
///
/// # Example
/// ```no_run
/// use actual_reader_lib::services::vision::VisionService;
///
/// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
/// let service = VisionService::default();
///
/// // Check if service is available
/// if service.health_check().await {
///     let caption = service.caption_image("base64_encoded_image_data").await?;
///     println!("Caption: {}", caption);
/// }
/// # Ok(())
/// # }
/// ```
pub struct VisionService {
    client: Client,
    endpoint: String,
}

impl VisionService {
    /// Create a new VisionService with a custom endpoint.
    ///
    /// # Arguments
    /// * `endpoint` - Base URL of the vision service (e.g., "http://localhost:60003")
    pub fn new(endpoint: String) -> Self {
        Self {
            client: Client::new(),
            endpoint,
        }
    }

    /// Get the configured endpoint URL.
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }

    /// Generate a caption for an image.
    ///
    /// Takes base64-encoded image data and returns a text description
    /// suitable for an audiobook listener.
    ///
    /// # Arguments
    /// * `image_base64` - Base64-encoded image data (PNG, JPEG, etc.)
    ///
    /// # Returns
    /// * `Ok(String)` - Generated caption text
    /// * `Err(VisionError)` - If the service is unavailable or processing fails
    ///
    /// # Example
    /// ```no_run
    /// use actual_reader_lib::services::vision::VisionService;
    ///
    /// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
    /// let service = VisionService::default();
    /// let caption = service.caption_image("iVBORw0KGgo...").await?;
    /// println!("Image shows: {}", caption);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn caption_image(&self, image_base64: &str) -> Result<String, VisionError> {
        self.caption_image_with_prompt(
            image_base64,
            "Describe this image concisely for an audiobook listener.",
        )
        .await
    }

    /// Generate a caption for an image with a custom prompt.
    ///
    /// This method allows specifying a custom prompt to guide the caption
    /// generation, useful for different contexts (e.g., technical diagrams
    /// vs. photographs).
    ///
    /// # Arguments
    /// * `image_base64` - Base64-encoded image data
    /// * `prompt` - Custom prompt to guide caption generation
    ///
    /// # Returns
    /// * `Ok(String)` - Generated caption text
    /// * `Err(VisionError)` - If the service is unavailable or processing fails
    pub async fn caption_image_with_prompt(
        &self,
        image_base64: &str,
        prompt: &str,
    ) -> Result<String, VisionError> {
        let request = CaptionRequest {
            image_base64: image_base64.to_string(),
            prompt: Some(prompt.to_string()),
        };

        let response = self
            .client
            .post(format!("{}/caption", self.endpoint))
            .json(&request)
            .send()
            .await
            .map_err(|e| VisionError::ServiceUnavailable(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(VisionError::ProcessingError(format!(
                "Server returned status {}: {}",
                status, body
            )));
        }

        let result: CaptionResponse = response
            .json()
            .await
            .map_err(|e| VisionError::ProcessingError(format!("Invalid response format: {}", e)))?;

        Ok(result.caption)
    }

    /// Check if the vision service is available.
    ///
    /// Makes a health check request to the service endpoint.
    ///
    /// # Returns
    /// * `true` - Service is available and responding
    /// * `false` - Service is unavailable or returned an error
    pub async fn health_check(&self) -> bool {
        self.client
            .get(format!("{}/health", self.endpoint))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }
}

impl Default for VisionService {
    /// Create a VisionService with the default endpoint (localhost:60003).
    fn default() -> Self {
        Self::new(DEFAULT_ENDPOINT.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vision_service_new() {
        let service = VisionService::new("http://example.com:8080".to_string());
        assert_eq!(service.endpoint(), "http://example.com:8080");
    }

    #[test]
    fn test_vision_service_default() {
        let service = VisionService::default();
        assert_eq!(service.endpoint(), DEFAULT_ENDPOINT);
    }

    #[test]
    fn test_caption_request_serialization() {
        let request = CaptionRequest {
            image_base64: "dGVzdA==".to_string(),
            prompt: Some("Describe this image.".to_string()),
        };
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("image_base64"));
        assert!(json.contains("dGVzdA=="));
        assert!(json.contains("prompt"));
    }

    #[test]
    fn test_caption_response_deserialization() {
        let json = r#"{"caption": "A cat sitting on a windowsill."}"#;
        let response: CaptionResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.caption, "A cat sitting on a windowsill.");
    }
}
