//! File system helpers for app data directories.

use std::path::{Path, PathBuf};

/// Application directory paths.
#[derive(Debug, Clone)]
pub struct AppPaths {
    /// Root data directory (~/ActualReader or app data dir).
    pub root: PathBuf,
    /// Database file path.
    pub database: PathBuf,
    /// Directory for original imported source files.
    pub sources: PathBuf,
    /// Directory for generated narration audio files.
    pub narration: PathBuf,
    /// Directory for exported .actualbook bundles.
    pub bundles: PathBuf,
}

impl AppPaths {
    /// Create AppPaths from a root directory.
    pub fn new(root: PathBuf) -> Self {
        Self {
            database: root.join("library.db"),
            sources: root.join("sources"),
            narration: root.join("narration"),
            bundles: root.join("bundles"),
            root,
        }
    }

    /// Ensure all directories exist.
    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.root)?;
        std::fs::create_dir_all(&self.sources)?;
        std::fs::create_dir_all(&self.narration)?;
        std::fs::create_dir_all(&self.bundles)?;
        Ok(())
    }

    /// Get the source file path for a book.
    pub fn source_path(&self, book_id: &str, extension: &str) -> PathBuf {
        self.sources.join(format!("{}.{}", book_id, extension))
    }

    /// Get the narration directory for a book.
    pub fn narration_path(&self, book_id: &str) -> PathBuf {
        self.narration.join(book_id)
    }

    /// Get the narration audio file path for a book.
    pub fn narration_audio_path(&self, book_id: &str) -> PathBuf {
        self.narration.join(book_id).join("audio.mp3")
    }

    /// Get the markers file path for a book's narration.
    pub fn markers_path(&self, book_id: &str) -> PathBuf {
        self.narration.join(book_id).join("markers.json")
    }

    /// Get the bundle file path.
    pub fn bundle_path(&self, book_id: &str) -> PathBuf {
        self.bundles.join(format!("{}.actualbook", book_id))
    }
}

/// Get the sources directory path.
pub fn get_sources_dir(root: &Path) -> PathBuf {
    root.join("sources")
}

/// Get the narration directory path.
pub fn get_narration_dir(root: &Path) -> PathBuf {
    root.join("narration")
}

/// Get the bundles directory path.
pub fn get_bundles_dir(root: &Path) -> PathBuf {
    root.join("bundles")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_paths() {
        let root = PathBuf::from("/home/user/ActualReader");
        let paths = AppPaths::new(root.clone());

        assert_eq!(paths.database, root.join("library.db"));
        assert_eq!(paths.sources, root.join("sources"));
        assert_eq!(paths.narration, root.join("narration"));
        assert_eq!(paths.bundles, root.join("bundles"));
    }

    #[test]
    fn test_source_path() {
        let paths = AppPaths::new(PathBuf::from("/data"));
        let book_id = "550e8400-e29b-41d4-a716-446655440000";

        assert_eq!(
            paths.source_path(book_id, "epub"),
            PathBuf::from("/data/sources/550e8400-e29b-41d4-a716-446655440000.epub")
        );
    }

    #[test]
    fn test_narration_paths() {
        let paths = AppPaths::new(PathBuf::from("/data"));
        let book_id = "550e8400-e29b-41d4-a716-446655440000";

        assert_eq!(
            paths.narration_audio_path(book_id),
            PathBuf::from("/data/narration/550e8400-e29b-41d4-a716-446655440000/audio.mp3")
        );

        assert_eq!(
            paths.markers_path(book_id),
            PathBuf::from("/data/narration/550e8400-e29b-41d4-a716-446655440000/markers.json")
        );
    }

    #[test]
    fn test_bundle_path() {
        let paths = AppPaths::new(PathBuf::from("/data"));
        let book_id = "550e8400-e29b-41d4-a716-446655440000";

        assert_eq!(
            paths.bundle_path(book_id),
            PathBuf::from("/data/bundles/550e8400-e29b-41d4-a716-446655440000.actualbook")
        );
    }
}
