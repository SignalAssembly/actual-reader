//! Actual Reader - Backend library for the cross-platform ebook reader.

pub mod models;
pub mod services;
pub mod storage;

use std::sync::Arc;
use storage::{init_database, AppPaths, Database};
use tauri::Manager;

/// Application state shared across all commands.
pub struct AppState {
    pub db: Arc<Database>,
    pub paths: AppPaths,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            };
            app.manage(state);

            log::info!("Actual Reader initialized successfully");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
