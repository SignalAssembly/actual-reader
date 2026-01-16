//! Bundle command handlers for Actual Reader.
//!
//! Commands for exporting and importing .actualbook bundle files.
//! Bundles package a book with its narration and markers for transfer between devices.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use tauri::State;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::models::{Book, BookId, Marker, NarrationStatus, Segment, SegmentId, SegmentType, SourceFormat};
use crate::AppState;

/// Bundle format version.
const BUNDLE_VERSION: &str = "1.0";

/// Information about a bundle file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleInfo {
    pub title: String,
    pub author: Option<String>,
    pub source_format: SourceFormat,
    pub segment_count: u32,
    pub has_narration: bool,
    pub duration: Option<f64>,
}

/// Manifest file structure in the bundle.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BundleManifest {
    version: String,
    id: String,
    title: String,
    author: Option<String>,
    source_format: String,
    created_at: i64,
    duration: Option<f64>,
    segment_count: u32,
}

/// Segment data for segments.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BundleSegment {
    id: String,
    index: u32,
    content: String,
    html: Option<String>,
}

/// Segments file structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BundleSegments {
    segments: Vec<BundleSegment>,
}

/// Marker data for markers.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BundleMarker {
    segment_id: String,
    start: f64,
    end: f64,
}

/// Markers file structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BundleMarkers {
    markers: Vec<BundleMarker>,
}

/// Get current Unix timestamp.
fn current_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// Export a book as an .actualbook bundle.
///
/// Creates a ZIP archive containing:
/// - manifest.json: Book metadata
/// - content/segments.json: Text segments
/// - narration/audio.mp3: Narration audio (if available)
/// - narration/markers.json: Timing markers (if available)
/// - assets/: Images and other assets (if any)
///
/// The book must have narration generated to be exported.
#[tauri::command]
pub async fn export_bundle(
    book_id: BookId,
    output_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 1. Verify book exists and has narration
    let book: Book = {
        let conn = state.db.connection().lock().unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT id, title, author, source_format, source_path, narration_status,
                        narration_path, created_at, updated_at, last_opened_at
                 FROM books WHERE id = ?",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        stmt.query_row(rusqlite::params![book_id.as_str()], |row| {
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
        })?
    };

    // Verify book has narration ready
    if book.narration_status != NarrationStatus::Ready {
        return Err("Book must have narration generated before exporting".to_string());
    }

    // 2. Fetch segments
    let segments: Vec<Segment> = {
        let conn = state.db.connection().lock().unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT id, book_id, idx, content, html
                 FROM segments WHERE book_id = ? ORDER BY idx ASC",
            )
            .map_err(|e| format!("Failed to prepare segments query: {}", e))?;

        let result = stmt
            .query_map(rusqlite::params![book_id.as_str()], |row| {
                Ok(Segment {
                    id: SegmentId::new(row.get::<_, String>(0)?),
                    book_id: BookId::new(row.get::<_, String>(1)?),
                    index: row.get(2)?,
                    content: row.get(3)?,
                    html: row.get(4)?,
                    segment_type: SegmentType::Text,
                    image_data: None,
                })
            })
            .map_err(|e| format!("Failed to query segments: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read segment row: {}", e))?;
        result
    };

    // 3. Fetch markers
    let markers: Vec<Marker> = {
        let conn = state.db.connection().lock().unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT segment_id, start_time, end_time
                 FROM markers WHERE book_id = ? ORDER BY start_time ASC",
            )
            .map_err(|e| format!("Failed to prepare markers query: {}", e))?;

        let result = stmt
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
        result
    };

    // Calculate duration from markers
    let duration = markers.iter().map(|m| m.end).fold(0.0_f64, |a, b| a.max(b));

    // 4. Create manifest
    let manifest = BundleManifest {
        version: BUNDLE_VERSION.to_string(),
        id: book.id.as_str().to_string(),
        title: book.title.clone(),
        author: book.author.clone(),
        source_format: book.source_format.as_str().to_string(),
        created_at: book.created_at,
        duration: if duration > 0.0 { Some(duration) } else { None },
        segment_count: segments.len() as u32,
    };

    // 5. Create segments.json data
    let bundle_segments = BundleSegments {
        segments: segments
            .iter()
            .map(|s| BundleSegment {
                id: s.id.as_str().to_string(),
                index: s.index,
                content: s.content.clone(),
                html: s.html.clone(),
            })
            .collect(),
    };

    // 6. Create markers.json data
    let bundle_markers = BundleMarkers {
        markers: markers
            .iter()
            .map(|m| BundleMarker {
                segment_id: m.segment_id.as_str().to_string(),
                start: m.start,
                end: m.end,
            })
            .collect(),
    };

    // 7. Get narration audio path
    let audio_path = state.paths.narration_audio_path(book_id.as_str());
    if !audio_path.exists() {
        return Err("Narration audio file not found".to_string());
    }

    // 8. Create ZIP archive
    let output_file = File::create(&output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut zip = ZipWriter::new(output_file);

    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // Write manifest.json
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
    zip.start_file("manifest.json", options)
        .map_err(|e| format!("Failed to write manifest to ZIP: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest content: {}", e))?;

    // Write content/segments.json
    let segments_json = serde_json::to_string_pretty(&bundle_segments)
        .map_err(|e| format!("Failed to serialize segments: {}", e))?;
    zip.start_file("content/segments.json", options)
        .map_err(|e| format!("Failed to write segments to ZIP: {}", e))?;
    zip.write_all(segments_json.as_bytes())
        .map_err(|e| format!("Failed to write segments content: {}", e))?;

    // Write narration/markers.json
    let markers_json = serde_json::to_string_pretty(&bundle_markers)
        .map_err(|e| format!("Failed to serialize markers: {}", e))?;
    zip.start_file("narration/markers.json", options)
        .map_err(|e| format!("Failed to write markers to ZIP: {}", e))?;
    zip.write_all(markers_json.as_bytes())
        .map_err(|e| format!("Failed to write markers content: {}", e))?;

    // Write narration/audio.mp3
    let mut audio_file = File::open(&audio_path)
        .map_err(|e| format!("Failed to open audio file: {}", e))?;
    let mut audio_data = Vec::new();
    audio_file
        .read_to_end(&mut audio_data)
        .map_err(|e| format!("Failed to read audio file: {}", e))?;

    // Use STORED compression for audio (already compressed)
    let audio_options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Stored)
        .unix_permissions(0o644);
    zip.start_file("narration/audio.mp3", audio_options)
        .map_err(|e| format!("Failed to write audio to ZIP: {}", e))?;
    zip.write_all(&audio_data)
        .map_err(|e| format!("Failed to write audio content: {}", e))?;

    // Finalize the ZIP
    zip.finish()
        .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    log::info!("Exported bundle to: {}", output_path);

    Ok(())
}

/// Import a book from an .actualbook bundle.
///
/// Extracts the bundle and adds the book to the library with its
/// narration and markers intact.
#[tauri::command]
pub async fn import_bundle(path: String, state: State<'_, AppState>) -> Result<Book, String> {
    // 1. Open and validate ZIP archive
    let bundle_file = File::open(&path)
        .map_err(|e| format!("Failed to open bundle file: {}", e))?;
    let mut archive = ZipArchive::new(bundle_file)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    // 2. Read and parse manifest.json
    let manifest: BundleManifest = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| "Bundle is missing manifest.json".to_string())?;
        let mut manifest_content = String::new();
        manifest_file
            .read_to_string(&mut manifest_content)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
        serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse manifest: {}", e))?
    };

    // 3. Read segments.json
    let bundle_segments: BundleSegments = {
        let mut segments_file = archive
            .by_name("content/segments.json")
            .map_err(|_| "Bundle is missing content/segments.json".to_string())?;
        let mut segments_content = String::new();
        segments_file
            .read_to_string(&mut segments_content)
            .map_err(|e| format!("Failed to read segments: {}", e))?;
        serde_json::from_str(&segments_content)
            .map_err(|e| format!("Failed to parse segments: {}", e))?
    };

    // 4. Read markers.json
    let bundle_markers: BundleMarkers = {
        let mut markers_file = archive
            .by_name("narration/markers.json")
            .map_err(|_| "Bundle is missing narration/markers.json".to_string())?;
        let mut markers_content = String::new();
        markers_file
            .read_to_string(&mut markers_content)
            .map_err(|e| format!("Failed to read markers: {}", e))?;
        serde_json::from_str(&markers_content)
            .map_err(|e| format!("Failed to parse markers: {}", e))?
    };

    // 5. Read audio file
    let audio_data: Vec<u8> = {
        let mut audio_file = archive
            .by_name("narration/audio.mp3")
            .map_err(|_| "Bundle is missing narration/audio.mp3".to_string())?;
        let mut data = Vec::new();
        audio_file
            .read_to_end(&mut data)
            .map_err(|e| format!("Failed to read audio: {}", e))?;
        data
    };

    // 6. Generate new book ID
    let new_book_id = BookId::new(Uuid::new_v4().to_string());

    // 7. Create narration directory and save audio
    let narration_dir = state.paths.narration_path(new_book_id.as_str());
    std::fs::create_dir_all(&narration_dir)
        .map_err(|e| format!("Failed to create narration directory: {}", e))?;

    let audio_path = state.paths.narration_audio_path(new_book_id.as_str());
    let mut audio_out = File::create(&audio_path)
        .map_err(|e| format!("Failed to create audio file: {}", e))?;
    audio_out
        .write_all(&audio_data)
        .map_err(|e| format!("Failed to write audio file: {}", e))?;

    // 8. Build segment ID mapping (old ID -> new ID)
    let mut segment_id_map: HashMap<String, String> = HashMap::new();
    let new_segments: Vec<(String, u32, String, Option<String>)> = bundle_segments
        .segments
        .iter()
        .map(|s| {
            let new_id = format!("seg_{}", Uuid::new_v4());
            segment_id_map.insert(s.id.clone(), new_id.clone());
            (new_id, s.index, s.content.clone(), s.html.clone())
        })
        .collect();

    // 9. Parse source format
    let source_format = SourceFormat::from_str(&manifest.source_format)
        .unwrap_or(SourceFormat::Txt);

    // 10. Create book record
    let now = current_timestamp();
    let book = Book {
        id: new_book_id.clone(),
        title: manifest.title,
        author: manifest.author,
        source_format,
        source_path: path.clone(), // Store original bundle path
        narration_status: NarrationStatus::Ready,
        narration_path: Some(narration_dir.to_string_lossy().to_string()),
        created_at: now,
        updated_at: now,
        last_opened_at: None,
    };

    // 11. Insert book and segments into database
    {
        let conn = state.db.connection().lock().unwrap();

        // Insert book
        conn.execute(
            "INSERT INTO books (id, title, author, source_format, source_path, narration_status, narration_path, created_at, updated_at, last_opened_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                book.id.as_str(),
                &book.title,
                &book.author,
                book.source_format.as_str(),
                &book.source_path,
                book.narration_status.as_str(),
                &book.narration_path,
                book.created_at,
                book.updated_at,
                book.last_opened_at,
            ],
        )
        .map_err(|e| format!("Failed to insert book: {}", e))?;

        // Insert segments
        let mut stmt = conn
            .prepare("INSERT INTO segments (id, book_id, idx, content, html) VALUES (?1, ?2, ?3, ?4, ?5)")
            .map_err(|e| format!("Failed to prepare segment insert: {}", e))?;

        for (seg_id, index, content, html) in &new_segments {
            stmt.execute(rusqlite::params![
                seg_id,
                book.id.as_str(),
                index,
                content,
                html,
            ])
            .map_err(|e| format!("Failed to insert segment: {}", e))?;
        }

        // Insert markers with updated segment IDs
        let mut marker_stmt = conn
            .prepare("INSERT INTO markers (id, book_id, segment_id, start_time, end_time) VALUES (?1, ?2, ?3, ?4, ?5)")
            .map_err(|e| format!("Failed to prepare marker insert: {}", e))?;

        for marker in &bundle_markers.markers {
            // Map old segment ID to new segment ID
            let new_segment_id = segment_id_map
                .get(&marker.segment_id)
                .ok_or_else(|| format!("Marker references unknown segment: {}", marker.segment_id))?;

            let marker_id = format!("marker_{}", Uuid::new_v4());
            marker_stmt
                .execute(rusqlite::params![
                    marker_id,
                    book.id.as_str(),
                    new_segment_id,
                    marker.start,
                    marker.end,
                ])
                .map_err(|e| format!("Failed to insert marker: {}", e))?;
        }
    }

    log::info!("Imported bundle: {} -> {}", path, new_book_id);

    Ok(book)
}

/// Validate a bundle file without importing it.
///
/// Returns information about the bundle contents for preview purposes.
#[tauri::command]
pub async fn validate_bundle(path: String) -> Result<BundleInfo, String> {
    // 1. Open ZIP archive
    let bundle_file = File::open(&path)
        .map_err(|e| format!("Failed to open bundle file: {}", e))?;
    let mut archive = ZipArchive::new(bundle_file)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    // 2. Read manifest.json
    let manifest: BundleManifest = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| "Bundle is missing manifest.json".to_string())?;
        let mut manifest_content = String::new();
        manifest_file
            .read_to_string(&mut manifest_content)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
        serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse manifest: {}", e))?
    };

    // 3. Verify required files exist
    let has_segments = archive.by_name("content/segments.json").is_ok();
    let has_audio = archive.by_name("narration/audio.mp3").is_ok();
    let has_markers = archive.by_name("narration/markers.json").is_ok();

    if !has_segments {
        return Err("Bundle is missing content/segments.json".to_string());
    }

    // Narration is considered present if both audio and markers exist
    let has_narration = has_audio && has_markers;

    // 4. Parse source format
    let source_format = SourceFormat::from_str(&manifest.source_format)
        .unwrap_or(SourceFormat::Txt);

    // 5. Return bundle info
    Ok(BundleInfo {
        title: manifest.title,
        author: manifest.author,
        source_format,
        segment_count: manifest.segment_count,
        has_narration,
        duration: manifest.duration,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_bundle_manifest_serialization() {
        let manifest = BundleManifest {
            version: "1.0".to_string(),
            id: "test-id".to_string(),
            title: "Test Book".to_string(),
            author: Some("Test Author".to_string()),
            source_format: "epub".to_string(),
            created_at: 1705334400,
            duration: Some(3600.5),
            segment_count: 150,
        };

        let json = serde_json::to_string(&manifest).unwrap();
        let parsed: BundleManifest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.version, "1.0");
        assert_eq!(parsed.title, "Test Book");
        assert_eq!(parsed.author, Some("Test Author".to_string()));
        assert_eq!(parsed.segment_count, 150);
    }

    #[test]
    fn test_bundle_segments_serialization() {
        let segments = BundleSegments {
            segments: vec![
                BundleSegment {
                    id: "seg_001".to_string(),
                    index: 0,
                    content: "Chapter 1".to_string(),
                    html: Some("<h1>Chapter 1</h1>".to_string()),
                },
                BundleSegment {
                    id: "seg_002".to_string(),
                    index: 1,
                    content: "Paragraph text".to_string(),
                    html: Some("<p>Paragraph text</p>".to_string()),
                },
            ],
        };

        let json = serde_json::to_string(&segments).unwrap();
        let parsed: BundleSegments = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.segments.len(), 2);
        assert_eq!(parsed.segments[0].id, "seg_001");
        assert_eq!(parsed.segments[1].index, 1);
    }

    #[test]
    fn test_bundle_markers_serialization() {
        let markers = BundleMarkers {
            markers: vec![
                BundleMarker {
                    segment_id: "seg_001".to_string(),
                    start: 0.0,
                    end: 2.5,
                },
                BundleMarker {
                    segment_id: "seg_002".to_string(),
                    start: 2.5,
                    end: 8.3,
                },
            ],
        };

        let json = serde_json::to_string(&markers).unwrap();
        let parsed: BundleMarkers = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.markers.len(), 2);
        assert_eq!(parsed.markers[0].start, 0.0);
        assert_eq!(parsed.markers[1].end, 8.3);
    }

    #[test]
    fn test_create_and_read_bundle_zip() {
        // Create a test bundle in memory
        let mut buffer = Vec::new();
        {
            let cursor = Cursor::new(&mut buffer);
            let mut zip = ZipWriter::new(cursor);
            let options = SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);

            // Write manifest
            let manifest = BundleManifest {
                version: "1.0".to_string(),
                id: "test-id".to_string(),
                title: "Test Book".to_string(),
                author: None,
                source_format: "txt".to_string(),
                created_at: 1705334400,
                duration: Some(10.0),
                segment_count: 1,
            };
            zip.start_file("manifest.json", options).unwrap();
            zip.write_all(serde_json::to_string(&manifest).unwrap().as_bytes())
                .unwrap();

            // Write segments
            let segments = BundleSegments {
                segments: vec![BundleSegment {
                    id: "seg_001".to_string(),
                    index: 0,
                    content: "Test content".to_string(),
                    html: None,
                }],
            };
            zip.start_file("content/segments.json", options).unwrap();
            zip.write_all(serde_json::to_string(&segments).unwrap().as_bytes())
                .unwrap();

            // Write markers
            let markers = BundleMarkers {
                markers: vec![BundleMarker {
                    segment_id: "seg_001".to_string(),
                    start: 0.0,
                    end: 10.0,
                }],
            };
            zip.start_file("narration/markers.json", options).unwrap();
            zip.write_all(serde_json::to_string(&markers).unwrap().as_bytes())
                .unwrap();

            // Write dummy audio
            zip.start_file("narration/audio.mp3", options).unwrap();
            zip.write_all(b"fake audio data").unwrap();

            zip.finish().unwrap();
        }

        // Read back the bundle
        let cursor = Cursor::new(&buffer);
        let mut archive = ZipArchive::new(cursor).unwrap();

        // Verify manifest
        {
            let mut manifest_file = archive.by_name("manifest.json").unwrap();
            let mut manifest_content = String::new();
            manifest_file.read_to_string(&mut manifest_content).unwrap();
            let manifest: BundleManifest = serde_json::from_str(&manifest_content).unwrap();
            assert_eq!(manifest.title, "Test Book");
        }

        // Verify segments
        {
            let mut segments_file = archive.by_name("content/segments.json").unwrap();
            let mut segments_content = String::new();
            segments_file.read_to_string(&mut segments_content).unwrap();
            let segments: BundleSegments = serde_json::from_str(&segments_content).unwrap();
            assert_eq!(segments.segments.len(), 1);
        }

        // Verify markers
        {
            let mut markers_file = archive.by_name("narration/markers.json").unwrap();
            let mut markers_content = String::new();
            markers_file.read_to_string(&mut markers_content).unwrap();
            let markers: BundleMarkers = serde_json::from_str(&markers_content).unwrap();
            assert_eq!(markers.markers.len(), 1);
        }
    }
}
