//! Library command handlers for Actual Reader.
//!
//! Commands for managing the book library: importing, listing, and deleting books.

use std::path::Path;

use tauri::State;
use uuid::Uuid;

use crate::models::{Book, BookId, NarrationStatus, SourceFormat};
use crate::services::parser::{self, SourceFormat as ParserSourceFormat};
use crate::AppState;

/// Convert parser SourceFormat to model SourceFormat.
fn parser_format_to_model_format(format: ParserSourceFormat) -> SourceFormat {
    match format {
        ParserSourceFormat::Epub => SourceFormat::Epub,
        ParserSourceFormat::Markdown => SourceFormat::Markdown,
        ParserSourceFormat::Txt => SourceFormat::Txt,
    }
}

/// Import a book from a file path into the library.
///
/// Parses the file (EPUB, Markdown, TXT, or PDF) and adds it to the library.
/// Returns the newly created Book.
#[tauri::command]
pub async fn import_book(path: String, state: State<'_, AppState>) -> Result<Book, String> {
    let source_path = Path::new(&path);

    // 1. Detect format from file extension
    let extension = source_path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or_else(|| "File has no extension".to_string())?;

    let parser_format = ParserSourceFormat::from_extension(extension)
        .ok_or_else(|| format!("Unsupported file format: {}", extension))?;

    let source_format = parser_format_to_model_format(parser_format);

    // 2. Parse the file to extract segments
    let parsed_book = parser::parse_file(source_path)
        .map_err(|e| format!("Failed to parse file: {}", e))?;

    // 3. Generate a new BookId (UUID)
    let book_id = BookId::new(Uuid::new_v4().to_string());

    // 4. Copy source file to sources directory
    let dest_path = state.paths.source_path(book_id.as_str(), extension);
    std::fs::copy(source_path, &dest_path)
        .map_err(|e| format!("Failed to copy source file: {}", e))?;

    // 5. Get current timestamp
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("System time error: {}", e))?
        .as_secs() as i64;

    // 6. Insert book into database
    let book = Book {
        id: book_id.clone(),
        title: parsed_book.title,
        author: parsed_book.author,
        source_format,
        source_path: dest_path.to_string_lossy().to_string(),
        narration_status: NarrationStatus::None,
        narration_path: None,
        created_at: now,
        updated_at: now,
        last_opened_at: None,
    };

    {
        let conn = state.db.connection().lock().unwrap();

        // Insert the book
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

        // Insert all segments
        let mut stmt = conn
            .prepare(
                "INSERT INTO segments (id, book_id, idx, content, html) VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .map_err(|e| format!("Failed to prepare segment insert: {}", e))?;

        for segment in &parsed_book.segments {
            stmt.execute(rusqlite::params![
                &segment.id,
                book.id.as_str(),
                segment.index,
                &segment.content,
                &segment.html,
            ])
            .map_err(|e| format!("Failed to insert segment: {}", e))?;
        }
    }

    Ok(book)
}

/// Get all books in the library.
///
/// Returns a list of all books, sorted by most recently opened (then by creation date).
#[tauri::command]
pub async fn get_library(state: State<'_, AppState>) -> Result<Vec<Book>, String> {
    let conn = state.db.connection().lock().unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT id, title, author, source_format, source_path, narration_status, narration_path, created_at, updated_at, last_opened_at
             FROM books
             ORDER BY last_opened_at DESC NULLS LAST, created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let books = stmt
        .query_map([], |row| {
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
        .map_err(|e| format!("Failed to query books: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read book row: {}", e))?;

    Ok(books)
}

/// Delete a book from the library.
///
/// Removes the book, its segments, markers, progress, and associated files
/// (source file and narration if present).
#[tauri::command]
pub async fn delete_book(id: BookId, state: State<'_, AppState>) -> Result<(), String> {
    // 1. Get the book info before deletion (for file paths)
    let (source_path, narration_path): (String, Option<String>) = {
        let conn = state.db.connection().lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT source_path, narration_path FROM books WHERE id = ?1")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        stmt.query_row([id.as_str()], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| format!("Book not found: {}", e))?
    };

    // 2. Delete from database (CASCADE handles segments, markers, progress)
    {
        let conn = state.db.connection().lock().unwrap();

        conn.execute("DELETE FROM books WHERE id = ?1", [id.as_str()])
            .map_err(|e| format!("Failed to delete book: {}", e))?;
    }

    // 3. Delete source file from sources directory
    let source_file = Path::new(&source_path);
    if source_file.exists() {
        std::fs::remove_file(source_file)
            .map_err(|e| format!("Failed to delete source file: {}", e))?;
    }

    // 4. Delete narration directory if exists
    if let Some(narration_dir) = narration_path {
        let narration_path = Path::new(&narration_dir);
        if narration_path.exists() && narration_path.is_dir() {
            std::fs::remove_dir_all(narration_path)
                .map_err(|e| format!("Failed to delete narration directory: {}", e))?;
        }
    } else {
        // Also check the default narration path location
        let default_narration_path = state.paths.narration_path(id.as_str());
        if default_narration_path.exists() {
            std::fs::remove_dir_all(&default_narration_path)
                .map_err(|e| format!("Failed to delete narration directory: {}", e))?;
        }
    }

    Ok(())
}
