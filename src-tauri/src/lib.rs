//! Actual Reader - Backend library for the cross-platform ebook reader.

pub mod commands;
pub mod models;
pub mod services;
pub mod storage;

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use storage::{init_database, AppPaths, Database};
use tauri::Manager;
use tokio::sync::RwLock;

/// Handle for the running sync server.
pub struct SyncServerHandle {
    /// Shutdown signal sender.
    pub shutdown_tx: tokio::sync::oneshot::Sender<()>,
    /// mDNS service daemon handle.
    pub mdns_daemon: mdns_sd::ServiceDaemon,
    /// The full service name registered with mDNS.
    pub service_fullname: String,
}

/// Handle for an active narration generation task.
pub struct GenerationHandle {
    /// Cancellation flag - set to true to stop generation.
    pub cancel_flag: Arc<AtomicBool>,
    /// The task handle for the generation.
    pub task_handle: tokio::task::JoinHandle<()>,
}

/// Application state shared across all commands.
pub struct AppState {
    pub db: Arc<Database>,
    pub paths: AppPaths,
    /// Handle to the running sync server, if any.
    pub sync_server: Arc<RwLock<Option<SyncServerHandle>>>,
    /// Active narration generation tasks, keyed by book ID.
    pub active_generations: Arc<RwLock<HashMap<String, GenerationHandle>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Library commands
            commands::import_book,
            commands::get_library,
            commands::delete_book,
            // Reader commands
            commands::get_book,
            commands::get_segments,
            commands::get_markers,
            commands::get_progress,
            commands::save_progress,
            // TTS commands (desktop only)
            commands::generate_narration,
            commands::cancel_generation,
            commands::get_voices,
            commands::create_voice,
            commands::delete_voice,
            commands::set_default_voice,
            // Bundle commands
            commands::export_bundle,
            commands::import_bundle,
            commands::validate_bundle,
            // Sync commands
            commands::start_sync_server,
            commands::stop_sync_server,
            commands::discover_sync_servers,
            commands::connect_to_server,
            commands::sync_with_server,
            commands::get_sync_status,
            // Settings commands
            commands::get_settings,
            commands::set_setting,
            commands::update_settings,
            commands::get_import_preferences,
            commands::set_import_preferences,
            commands::reset_settings,
            commands::get_data_directory,
        ])
        .setup(|app| {
            // Set up logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Get the app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // Set up application paths
            let paths = AppPaths::new(app_data_dir);
            paths.ensure_dirs().expect("Failed to create app directories");

            // Initialize the database
            let db = init_database(&paths.database)
                .expect("Failed to initialize database");

            // Store state for use in commands
            let state = AppState {
                db: Arc::new(db),
                paths,
                sync_server: Arc::new(RwLock::new(None)),
                active_generations: Arc::new(RwLock::new(HashMap::new())),
            };
            app.manage(state);

            log::info!("Actual Reader initialized successfully");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
