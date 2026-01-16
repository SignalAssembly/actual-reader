//! SQLite database initialization and management.

use rusqlite::{Connection, Result as SqliteResult};
use std::path::Path;
use std::sync::Mutex;

/// Wrapper around SQLite connection with thread-safe access.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Open a database connection at the specified path.
    pub fn open(path: &Path) -> SqliteResult<Self> {
        let conn = Connection::open(path)?;

        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Get a reference to the connection for executing queries.
    /// The caller is responsible for locking.
    pub fn connection(&self) -> &Mutex<Connection> {
        &self.conn
    }
}

/// Initialize the database with all required tables.
///
/// Creates the database file if it doesn't exist and runs migrations.
pub fn init_database(db_path: &Path) -> SqliteResult<Database> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let db = Database::open(db_path)?;

    // Create all tables
    {
        let conn = db.conn.lock().unwrap();
        create_tables(&conn)?;
    }

    Ok(db)
}

/// Create all database tables as defined in ARCHITECTURE.md.
fn create_tables(conn: &Connection) -> SqliteResult<()> {
    conn.execute_batch(
        r#"
        -- Books in library
        CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT,
            source_format TEXT NOT NULL,
            source_path TEXT NOT NULL,
            narration_status TEXT NOT NULL DEFAULT 'none',
            narration_path TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_opened_at INTEGER
        );

        -- Text segments
        CREATE TABLE IF NOT EXISTS segments (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            idx INTEGER NOT NULL,
            content TEXT NOT NULL,
            html TEXT,
            UNIQUE(book_id, idx)
        );

        -- Narration markers
        CREATE TABLE IF NOT EXISTS markers (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            UNIQUE(segment_id)
        );

        -- Reading progress
        CREATE TABLE IF NOT EXISTS progress (
            book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
            segment_index INTEGER NOT NULL,
            audio_time REAL,
            updated_at INTEGER NOT NULL
        );

        -- Voices
        CREATE TABLE IF NOT EXISTS voices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            engine TEXT NOT NULL,
            sample_path TEXT,
            is_default INTEGER NOT NULL DEFAULT 0
        );

        -- Settings (key-value store)
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- Create indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_segments_book_id ON segments(book_id);
        CREATE INDEX IF NOT EXISTS idx_markers_book_id ON markers(book_id);
        CREATE INDEX IF NOT EXISTS idx_books_last_opened ON books(last_opened_at);
        "#,
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_init_database() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = init_database(&db_path).expect("Failed to initialize database");

        // Verify tables exist
        let conn = db.conn.lock().unwrap();
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"books".to_string()));
        assert!(tables.contains(&"segments".to_string()));
        assert!(tables.contains(&"markers".to_string()));
        assert!(tables.contains(&"progress".to_string()));
        assert!(tables.contains(&"voices".to_string()));
        assert!(tables.contains(&"settings".to_string()));
    }
}
