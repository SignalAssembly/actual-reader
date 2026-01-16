//! Settings command handlers for Actual Reader.
//!
//! Commands for managing application settings stored as key-value pairs.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::models::VoiceId;
use crate::AppState;

/// All application settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// UI theme: "light", "dark", or "system".
    pub theme: String,
    /// Reader font size in pixels.
    pub font_size: u32,
    /// Reader font family.
    pub font_family: String,
    /// Line height multiplier.
    pub line_height: f64,
    /// Narration playback speed (0.5-2.0).
    pub playback_speed: f64,
    /// Segment highlight color (hex).
    pub highlight_color: String,
    /// Default voice for narration generation.
    pub default_voice: Option<VoiceId>,
    /// Auto-play narration when opening a book.
    pub auto_play: bool,
    /// Local sync server port.
    pub sync_port: u16,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            font_size: 16,
            font_family: "system".to_string(),
            line_height: 1.6,
            playback_speed: 1.0,
            highlight_color: "#ffeb3b".to_string(),
            default_voice: None,
            auto_play: false,
            sync_port: 42069,
        }
    }
}

/// Setting keys used in the database.
mod keys {
    pub const THEME: &str = "theme";
    pub const FONT_SIZE: &str = "fontSize";
    pub const FONT_FAMILY: &str = "fontFamily";
    pub const LINE_HEIGHT: &str = "lineHeight";
    pub const PLAYBACK_SPEED: &str = "playbackSpeed";
    pub const HIGHLIGHT_COLOR: &str = "highlightColor";
    pub const DEFAULT_VOICE: &str = "defaultVoice";
    pub const AUTO_PLAY: &str = "autoPlay";
    pub const SYNC_PORT: &str = "syncPort";
    pub const AUTO_PROCESS: &str = "autoProcess";
    pub const SHOW_IMPORT_MODAL: &str = "showImportModal";
}

impl Settings {
    /// Build Settings from a HashMap of key-value pairs, using defaults for missing keys.
    fn from_map(map: &HashMap<String, String>) -> Self {
        let defaults = Settings::default();

        Settings {
            theme: map
                .get(keys::THEME)
                .cloned()
                .unwrap_or(defaults.theme),
            font_size: map
                .get(keys::FONT_SIZE)
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.font_size),
            font_family: map
                .get(keys::FONT_FAMILY)
                .cloned()
                .unwrap_or(defaults.font_family),
            line_height: map
                .get(keys::LINE_HEIGHT)
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.line_height),
            playback_speed: map
                .get(keys::PLAYBACK_SPEED)
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.playback_speed),
            highlight_color: map
                .get(keys::HIGHLIGHT_COLOR)
                .cloned()
                .unwrap_or(defaults.highlight_color),
            default_voice: map
                .get(keys::DEFAULT_VOICE)
                .filter(|v| !v.is_empty())
                .map(|v| VoiceId::new(v.clone())),
            auto_play: map
                .get(keys::AUTO_PLAY)
                .map(|v| v == "true")
                .unwrap_or(defaults.auto_play),
            sync_port: map
                .get(keys::SYNC_PORT)
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.sync_port),
        }
    }

    /// Convert Settings to a list of key-value pairs for storage.
    fn to_pairs(&self) -> Vec<(&'static str, String)> {
        vec![
            (keys::THEME, self.theme.clone()),
            (keys::FONT_SIZE, self.font_size.to_string()),
            (keys::FONT_FAMILY, self.font_family.clone()),
            (keys::LINE_HEIGHT, self.line_height.to_string()),
            (keys::PLAYBACK_SPEED, self.playback_speed.to_string()),
            (keys::HIGHLIGHT_COLOR, self.highlight_color.clone()),
            (
                keys::DEFAULT_VOICE,
                self.default_voice
                    .as_ref()
                    .map(|v| v.0.clone())
                    .unwrap_or_default(),
            ),
            (keys::AUTO_PLAY, self.auto_play.to_string()),
            (keys::SYNC_PORT, self.sync_port.to_string()),
        ]
    }
}

/// Import preferences for new books.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreferences {
    /// Automatically generate narration when importing.
    pub auto_process: bool,
    /// Show the import options modal.
    pub show_import_modal: bool,
}

impl Default for ImportPreferences {
    fn default() -> Self {
        Self {
            auto_process: false,
            show_import_modal: true,
        }
    }
}

impl ImportPreferences {
    /// Build ImportPreferences from a HashMap of key-value pairs, using defaults for missing keys.
    fn from_map(map: &HashMap<String, String>) -> Self {
        let defaults = ImportPreferences::default();

        ImportPreferences {
            auto_process: map
                .get(keys::AUTO_PROCESS)
                .map(|v| v == "true")
                .unwrap_or(defaults.auto_process),
            show_import_modal: map
                .get(keys::SHOW_IMPORT_MODAL)
                .map(|v| v == "true")
                .unwrap_or(defaults.show_import_modal),
        }
    }

    /// Convert ImportPreferences to a list of key-value pairs for storage.
    fn to_pairs(&self) -> Vec<(&'static str, String)> {
        vec![
            (keys::AUTO_PROCESS, self.auto_process.to_string()),
            (keys::SHOW_IMPORT_MODAL, self.show_import_modal.to_string()),
        ]
    }
}

/// Query all settings from the database as a HashMap.
fn query_all_settings(state: &AppState) -> Result<HashMap<String, String>, String> {
    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to query settings: {}", e))?;

    let mut map = HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(|e| format!("Failed to read row: {}", e))?;
        map.insert(key, value);
    }

    Ok(map)
}

/// Get all settings.
///
/// Returns the current settings, with defaults for any missing keys.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let map = query_all_settings(&state)?;
    Ok(Settings::from_map(&map))
}

/// Update a setting.
///
/// Updates a single setting key with a new value.
#[tauri::command]
pub async fn set_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )
    .map_err(|e| format!("Failed to set setting: {}", e))?;

    Ok(())
}

/// Update multiple settings at once.
#[tauri::command]
pub async fn update_settings(settings: Settings, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    {
        let mut stmt = tx
            .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        for (key, value) in settings.to_pairs() {
            stmt.execute(rusqlite::params![key, value])
                .map_err(|e| format!("Failed to update setting '{}': {}", key, e))?;
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}

/// Get import preferences.
#[tauri::command]
pub async fn get_import_preferences(state: State<'_, AppState>) -> Result<ImportPreferences, String> {
    let map = query_all_settings(&state)?;
    Ok(ImportPreferences::from_map(&map))
}

/// Update import preferences.
#[tauri::command]
pub async fn set_import_preferences(
    preferences: ImportPreferences,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    {
        let mut stmt = tx
            .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        for (key, value) in preferences.to_pairs() {
            stmt.execute(rusqlite::params![key, value])
                .map_err(|e| format!("Failed to update preference '{}': {}", key, e))?;
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}

/// Reset all settings to defaults.
#[tauri::command]
pub async fn reset_settings(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM settings", [])
        .map_err(|e| format!("Failed to reset settings: {}", e))?;

    Ok(())
}

/// Get the application data directory path.
///
/// Returns the path where Actual Reader stores its data (library.db, sources, narration, etc.).
#[tauri::command]
pub async fn get_data_directory(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.paths.root.display().to_string())
}
