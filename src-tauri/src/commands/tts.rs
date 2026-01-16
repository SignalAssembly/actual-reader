//! TTS command handlers for Actual Reader (desktop only).
//!
//! Commands for narration generation using Chatterbox TTS engine.
//! These commands are only available on desktop platforms.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::models::{BookId, Marker, SegmentId, Voice, VoiceId};
use crate::services::tts::{get_wav_duration, TtsService};
use crate::{AppState, GenerationHandle};

/// Stage of narration generation.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GenerationStage {
    Extracting,
    Captioning,
    Narrating,
    Finalizing,
}

/// Progress update during narration generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationProgress {
    pub book_id: BookId,
    pub stage: GenerationStage,
    pub current: u32,
    pub total: u32,
    pub message: String,
}

/// Error event payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationError {
    pub book_id: BookId,
    pub message: String,
}

/// Get the current Unix timestamp in seconds.
fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// Generate narration for a book.
///
/// This command starts the narration generation process which:
/// 1. Extracts text and images from segments
/// 2. Generates captions for images (if any)
/// 3. Generates narration for each segment using Chatterbox
/// 4. Concatenates and saves the final audio file
///
/// Progress updates are emitted via the `generation_progress` event.
/// Completion is signaled via `generation_complete` or `generation_error` events.
#[tauri::command]
pub async fn generate_narration(
    book_id: BookId,
    voice_id: VoiceId,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Check if generation is already in progress for this book
    {
        let generations = state.active_generations.read().await;
        if generations.contains_key(book_id.as_str()) {
            return Err("Generation already in progress for this book".to_string());
        }
    }

    // Get the voice sample path
    let voice_sample_path = {
        let conn = state.db.connection().lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT sample_path FROM voices WHERE id = ?")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        stmt.query_row(rusqlite::params![voice_id.as_str()], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "Voice not found".to_string(),
            _ => format!("Database error: {}", e),
        })?
    };

    // Get segments for the book
    let segments: Vec<(String, String)> = {
        let conn = state.db.connection().lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, content FROM segments WHERE book_id = ? ORDER BY idx ASC")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let result: Vec<(String, String)> = stmt
            .query_map(rusqlite::params![book_id.as_str()], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| format!("Failed to query segments: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read segment: {}", e))?;
        result
    };

    if segments.is_empty() {
        return Err("Book has no segments to narrate".to_string());
    }

    // Update narration_status to 'generating'
    {
        let conn = state.db.connection().lock().unwrap();
        conn.execute(
            "UPDATE books SET narration_status = 'generating', updated_at = ? WHERE id = ?",
            rusqlite::params![current_timestamp(), book_id.as_str()],
        )
        .map_err(|e| format!("Failed to update book status: {}", e))?;
    }

    // Create cancellation flag
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let cancel_flag_clone = cancel_flag.clone();

    // Clone necessary data for the spawned task
    let book_id_clone = book_id.clone();
    let db = state.db.clone();
    let narration_dir = state.paths.narration.clone();
    let active_generations = state.active_generations.clone();

    // Spawn the generation task
    let task_handle = tokio::spawn(async move {
        let result = run_generation(
            &book_id_clone,
            &voice_sample_path,
            segments,
            &narration_dir,
            &app_handle,
            cancel_flag_clone,
        )
        .await;

        // Handle result - use a block to ensure conn is dropped before the await
        let now = current_timestamp();
        match result {
            Ok(narration_path) => {
                // Update book status to 'ready'
                {
                    let conn = db.connection().lock().unwrap();
                    if let Err(e) = conn.execute(
                        "UPDATE books SET narration_status = 'ready', narration_path = ?, updated_at = ? WHERE id = ?",
                        rusqlite::params![narration_path, now, book_id_clone.as_str()],
                    ) {
                        log::error!("Failed to update book status: {}", e);
                    }
                }

                // Emit completion event
                if let Err(e) = app_handle.emit("generation_complete", &book_id_clone) {
                    log::error!("Failed to emit completion event: {}", e);
                }
            }
            Err(e) => {
                // Update book status back to 'none'
                {
                    let conn = db.connection().lock().unwrap();
                    if let Err(db_err) = conn.execute(
                        "UPDATE books SET narration_status = 'none', updated_at = ? WHERE id = ?",
                        rusqlite::params![now, book_id_clone.as_str()],
                    ) {
                        log::error!("Failed to reset book status: {}", db_err);
                    }
                }

                // Emit error event
                let error = GenerationError {
                    book_id: book_id_clone.clone(),
                    message: e,
                };
                if let Err(emit_err) = app_handle.emit("generation_error", &error) {
                    log::error!("Failed to emit error event: {}", emit_err);
                }
            }
        }

        // Remove from active generations
        let mut generations = active_generations.write().await;
        generations.remove(book_id_clone.as_str());
    });

    // Store the generation handle
    {
        let mut generations = state.active_generations.write().await;
        generations.insert(
            book_id.as_str().to_string(),
            GenerationHandle {
                cancel_flag,
                task_handle,
            },
        );
    }

    Ok(())
}

/// Internal function to run the generation process.
async fn run_generation(
    book_id: &BookId,
    voice_sample: &str,
    segments: Vec<(String, String)>,
    narration_dir: &Path,
    app_handle: &AppHandle,
    cancel_flag: Arc<AtomicBool>,
) -> Result<String, String> {
    let tts = TtsService::new();

    // Check if TTS server is available
    if !tts.is_available().await {
        return Err("Chatterbox TTS server is not available. Please ensure it's running at http://localhost:60001".to_string());
    }

    let total_segments = segments.len() as u32;
    let mut audio_segments: Vec<Vec<u8>> = Vec::with_capacity(segments.len());
    let mut markers: Vec<Marker> = Vec::with_capacity(segments.len());
    let mut current_time: f64 = 0.0;

    // Emit extracting stage
    let _ = app_handle.emit(
        "generation_progress",
        &GenerationProgress {
            book_id: book_id.clone(),
            stage: GenerationStage::Extracting,
            current: 0,
            total: total_segments,
            message: "Preparing segments...".to_string(),
        },
    );

    // Generate audio for each segment
    for (i, (segment_id, content)) in segments.into_iter().enumerate() {
        // Check for cancellation
        if cancel_flag.load(Ordering::Relaxed) {
            return Err("Generation cancelled".to_string());
        }

        // Skip empty segments
        let content = content.trim();
        if content.is_empty() {
            continue;
        }

        // Emit progress
        let _ = app_handle.emit(
            "generation_progress",
            &GenerationProgress {
                book_id: book_id.clone(),
                stage: GenerationStage::Narrating,
                current: i as u32 + 1,
                total: total_segments,
                message: format!("Generating audio for segment {} of {}...", i + 1, total_segments),
            },
        );

        // Generate audio for this segment
        let audio = tts
            .generate_audio(content, voice_sample, 0.3, 0.5, 0.8)
            .await
            .map_err(|e| format!("TTS generation failed for segment {}: {}", i + 1, e))?;

        // Get duration of this audio segment
        let duration = get_wav_duration(&audio)
            .map_err(|e| format!("Failed to get audio duration: {}", e))?;

        // Create marker for this segment
        markers.push(Marker {
            segment_id: SegmentId::new(segment_id),
            start: current_time,
            end: current_time + duration,
        });

        current_time += duration;
        audio_segments.push(audio);
    }

    // Check for cancellation before finalizing
    if cancel_flag.load(Ordering::Relaxed) {
        return Err("Generation cancelled".to_string());
    }

    // Emit finalizing stage
    let _ = app_handle.emit(
        "generation_progress",
        &GenerationProgress {
            book_id: book_id.clone(),
            stage: GenerationStage::Finalizing,
            current: total_segments,
            total: total_segments,
            message: "Combining audio segments...".to_string(),
        },
    );

    // Concatenate all audio segments
    let final_audio = if audio_segments.is_empty() {
        return Err("No audio was generated (all segments were empty)".to_string());
    } else {
        tts.concatenate_audio(audio_segments)
            .map_err(|e| format!("Failed to concatenate audio: {}", e))?
    };

    // Create narration directory for this book
    let book_narration_dir = narration_dir.join(book_id.as_str());
    std::fs::create_dir_all(&book_narration_dir)
        .map_err(|e| format!("Failed to create narration directory: {}", e))?;

    // Save the audio file (as WAV for now - could convert to MP3 later)
    let audio_path = book_narration_dir.join("audio.wav");
    std::fs::write(&audio_path, &final_audio)
        .map_err(|e| format!("Failed to save audio file: {}", e))?;

    // Save markers
    let markers_path = book_narration_dir.join("markers.json");
    let markers_json = serde_json::to_string_pretty(&markers)
        .map_err(|e| format!("Failed to serialize markers: {}", e))?;
    std::fs::write(&markers_path, markers_json)
        .map_err(|e| format!("Failed to save markers: {}", e))?;

    Ok(audio_path.to_string_lossy().to_string())
}

/// Cancel ongoing narration generation.
///
/// Stops the current generation process if one is running.
/// The book status will be reset to 'none'.
#[tauri::command]
pub async fn cancel_generation(book_id: BookId, state: State<'_, AppState>) -> Result<(), String> {
    // Get the generation handle
    let handle = {
        let mut generations = state.active_generations.write().await;
        generations.remove(book_id.as_str())
    };

    match handle {
        Some(gen_handle) => {
            // Signal cancellation
            gen_handle.cancel_flag.store(true, Ordering::Relaxed);

            // Wait for the task to complete (with timeout)
            let _ = tokio::time::timeout(
                std::time::Duration::from_secs(5),
                gen_handle.task_handle,
            )
            .await;

            // Update book status to 'none'
            let conn = state.db.connection().lock().unwrap();
            conn.execute(
                "UPDATE books SET narration_status = 'none', updated_at = ? WHERE id = ?",
                rusqlite::params![current_timestamp(), book_id.as_str()],
            )
            .map_err(|e| format!("Failed to update book status: {}", e))?;

            // Clean up partial files
            let narration_dir = state.paths.narration.join(book_id.as_str());
            if narration_dir.exists() {
                let _ = std::fs::remove_dir_all(&narration_dir);
            }

            Ok(())
        }
        None => {
            // No active generation for this book
            Ok(())
        }
    }
}

/// Get all available voices.
///
/// Returns the list of voice profiles that can be used for narration generation.
#[tauri::command]
pub async fn get_voices(state: State<'_, AppState>) -> Result<Vec<Voice>, String> {
    let conn = state.db.connection().lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT id, name, sample_path, is_default FROM voices ORDER BY is_default DESC, name ASC")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let voices = stmt
        .query_map([], |row| {
            Ok(Voice {
                id: VoiceId::new(row.get::<_, String>(0)?),
                name: row.get(1)?,
                sample_path: row.get(2)?,
                is_default: row.get::<_, i32>(3)? != 0,
            })
        })
        .map_err(|e| format!("Failed to query voices: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read voice row: {}", e))?;

    Ok(voices)
}

/// Create a new voice profile from a sample.
///
/// The sample should be a WAV or MP3 file containing a clear voice recording.
/// Chatterbox will use this sample for voice cloning.
#[tauri::command]
pub async fn create_voice(
    name: String,
    sample_path: String,
    state: State<'_, AppState>,
) -> Result<Voice, String> {
    // Validate the sample file exists
    let source_path = Path::new(&sample_path);
    if !source_path.exists() {
        return Err(format!("Sample file not found: {}", sample_path));
    }

    // Get the file extension
    let extension = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("wav")
        .to_lowercase();

    // Validate it's an audio file
    if !["wav", "mp3", "ogg", "flac"].contains(&extension.as_str()) {
        return Err(format!(
            "Invalid audio format: {}. Supported formats: wav, mp3, ogg, flac",
            extension
        ));
    }

    // Generate a new voice ID
    let voice_id = VoiceId::new(format!("voice_{}", uuid::Uuid::new_v4()));

    // Copy the sample to the voices directory
    let dest_path = state.paths.voice_sample_path(voice_id.as_str(), &extension);
    std::fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy sample file: {}", e))?;

    // Check if this is the first voice (make it default)
    let is_first_voice = {
        let conn = state.db.connection().lock().unwrap();
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM voices", [], |row| row.get(0))
            .unwrap_or(0);
        count == 0
    };

    // Insert into database
    {
        let conn = state.db.connection().lock().unwrap();
        conn.execute(
            "INSERT INTO voices (id, name, engine, sample_path, is_default) VALUES (?, ?, 'chatterbox', ?, ?)",
            rusqlite::params![
                voice_id.as_str(),
                &name,
                dest_path.to_string_lossy().to_string(),
                if is_first_voice { 1 } else { 0 }
            ],
        )
        .map_err(|e| format!("Failed to insert voice: {}", e))?;
    }

    Ok(Voice {
        id: voice_id,
        name,
        sample_path: dest_path.to_string_lossy().to_string(),
        is_default: is_first_voice,
    })
}

/// Delete a voice profile.
///
/// Removes the voice from the database and deletes the sample file.
#[tauri::command]
pub async fn delete_voice(id: VoiceId, state: State<'_, AppState>) -> Result<(), String> {
    // Get the voice info first
    let (sample_path, is_default): (String, bool) = {
        let conn = state.db.connection().lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT sample_path, is_default FROM voices WHERE id = ?")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        stmt.query_row(rusqlite::params![id.as_str()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)? != 0))
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "Voice not found".to_string(),
            _ => format!("Database error: {}", e),
        })?
    };

    // Check if any books are using this voice (optional - could also just warn)
    // For now, we allow deletion but the user should be aware

    // Delete from database
    {
        let conn = state.db.connection().lock().unwrap();
        conn.execute("DELETE FROM voices WHERE id = ?", rusqlite::params![id.as_str()])
            .map_err(|e| format!("Failed to delete voice: {}", e))?;
    }

    // Delete the sample file
    let sample_file = Path::new(&sample_path);
    if sample_file.exists() {
        std::fs::remove_file(sample_file)
            .map_err(|e| format!("Failed to delete sample file: {}", e))?;
    }

    // If this was the default voice, set another voice as default
    if is_default {
        let conn = state.db.connection().lock().unwrap();
        // Set the first remaining voice as default
        let _ = conn.execute(
            "UPDATE voices SET is_default = 1 WHERE id = (SELECT id FROM voices LIMIT 1)",
            [],
        );
    }

    Ok(())
}

/// Set a voice as the default for new narration generation.
#[tauri::command]
pub async fn set_default_voice(id: VoiceId, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.connection().lock().unwrap();

    // Verify the voice exists
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM voices WHERE id = ?",
            rusqlite::params![id.as_str()],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !exists {
        return Err("Voice not found".to_string());
    }

    // Clear is_default on all voices
    conn.execute("UPDATE voices SET is_default = 0", [])
        .map_err(|e| format!("Failed to clear default voices: {}", e))?;

    // Set is_default on the specified voice
    conn.execute(
        "UPDATE voices SET is_default = 1 WHERE id = ?",
        rusqlite::params![id.as_str()],
    )
    .map_err(|e| format!("Failed to set default voice: {}", e))?;

    Ok(())
}
