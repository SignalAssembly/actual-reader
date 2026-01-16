//! Reader command handlers for Actual Reader.
//!
//! Commands for reading books: fetching book data, segments, markers, and managing progress.

use std::time::{SystemTime, UNIX_EPOCH};

use tauri::State;

use crate::models::{
    Book, BookId, Marker, NarrationStatus, Progress, Segment, SegmentId, SegmentType, SourceFormat,
};
use crate::AppState;

/// Get the current Unix timestamp in seconds.
fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// Get a single book by ID.
///
/// Also updates the book's last_opened_at timestamp.
#[tauri::command]
pub async fn get_book(id: BookId, state: State<'_, AppState>) -> Result<Book, String> {
    let conn = state.db.connection().lock().unwrap();
    let now = current_timestamp();

    // Update last_opened_at timestamp
    conn.execute(
        "UPDATE books SET last_opened_at = ? WHERE id = ?",
        rusqlite::params![now, id.as_str()],
    )
    .map_err(|e| format!("Failed to update last_opened_at: {}", e))?;

    // Fetch the book
    let mut stmt = conn
        .prepare(
            "SELECT id, title, author, source_format, source_path, narration_status,
                    narration_path, created_at, updated_at, last_opened_at
             FROM books WHERE id = ?",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let book = stmt
        .query_row(rusqlite::params![id.as_str()], |row| {
            let source_format_str: String = row.get(3)?;
            let narration_status_str: String = row.get(5)?;

            Ok(Book {
                id: BookId::new(row.get::<_, String>(0)?),
                title: row.get(1)?,
                author: row.get(2)?,
                source_format: SourceFormat::from_str(&source_format_str)
                    .unwrap_or(SourceFormat::Txt),
                source_path: row.get(4)?,
                narration_status: NarrationStatus::from_str(&narration_status_str)
                    .unwrap_or(NarrationStatus::None),
                narration_path: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                last_opened_at: row.get(9)?,
            })
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "Book not found".to_string(),
            _ => format!("Database error: {}", e),
        })?;

    Ok(book)
}

/// Get all segments for a book.
///
/// Returns segments in order by index for display in the reader.
#[tauri::command]
pub async fn get_segments(
    book_id: BookId,
    state: State<'_, AppState>,
) -> Result<Vec<Segment>, String> {
    let conn = state.db.connection().lock().unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT id, book_id, idx, content, html
             FROM segments WHERE book_id = ? ORDER BY idx ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let segments = stmt
        .query_map(rusqlite::params![book_id.as_str()], |row| {
            Ok(Segment {
                id: SegmentId::new(row.get::<_, String>(0)?),
                book_id: BookId::new(row.get::<_, String>(1)?),
                index: row.get(2)?,
                content: row.get(3)?,
                html: row.get(4)?,
                segment_type: SegmentType::Text, // Default to text; could be extended
                image_data: None,                // Not stored in basic schema
            })
        })
        .map_err(|e| format!("Failed to query segments: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read segment row: {}", e))?;

    Ok(segments)
}

/// Get all narration markers for a book.
///
/// Returns markers in order by start time for syncing text highlighting with narration playback.
#[tauri::command]
pub async fn get_markers(
    book_id: BookId,
    state: State<'_, AppState>,
) -> Result<Vec<Marker>, String> {
    let conn = state.db.connection().lock().unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT segment_id, start_time, end_time
             FROM markers WHERE book_id = ? ORDER BY start_time ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let markers = stmt
        .query_map(rusqlite::params![book_id.as_str()], |row| {
            Ok(Marker {
                segment_id: SegmentId::new(row.get::<_, String>(0)?),
                start: row.get(1)?,
                end: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query markers: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read marker row: {}", e))?;

    Ok(markers)
}

/// Get reading progress for a book.
///
/// Returns None if no progress has been saved yet.
#[tauri::command]
pub async fn get_progress(
    book_id: BookId,
    state: State<'_, AppState>,
) -> Result<Option<Progress>, String> {
    let conn = state.db.connection().lock().unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT book_id, segment_index, audio_time, updated_at
             FROM progress WHERE book_id = ?",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let result = stmt.query_row(rusqlite::params![book_id.as_str()], |row| {
        Ok(Progress {
            book_id: BookId::new(row.get::<_, String>(0)?),
            segment_index: row.get(1)?,
            audio_time: row.get(2)?,
            updated_at: row.get(3)?,
        })
    });

    match result {
        Ok(progress) => Ok(Some(progress)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Save reading progress for a book.
///
/// Creates or updates the progress record. The progress includes:
/// - segment_index: Current segment being read
/// - audio_time: Current position in narration (if playing)
#[tauri::command]
pub async fn save_progress(
    book_id: BookId,
    segment_index: u32,
    audio_time: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.connection().lock().unwrap();
    let now = current_timestamp();

    conn.execute(
        "INSERT OR REPLACE INTO progress (book_id, segment_index, audio_time, updated_at)
         VALUES (?, ?, ?, ?)",
        rusqlite::params![book_id.as_str(), segment_index, audio_time, now],
    )
    .map_err(|e| format!("Failed to save progress: {}", e))?;

    Ok(())
}
