//! Sync command handlers for Actual Reader.
//!
//! Commands for syncing books and progress between desktop and mobile devices
//! over local WiFi.

use std::collections::HashMap;
use std::io::Read as IoRead;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{Path as AxumPath, State as AxumState};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Json;
use axum::Router;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

use crate::models::{Book, BookId, NarrationStatus, SourceFormat};
use crate::storage::AppPaths;
use crate::AppState;

/// Service type for mDNS discovery.
const MDNS_SERVICE_TYPE: &str = "_actualreader._tcp.local.";

/// Information about a discovered sync server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncServer {
    /// Device name (e.g., "My Desktop").
    pub name: String,
    /// IP address of the server.
    pub address: String,
    /// Port the server is listening on.
    pub port: u16,
    /// Number of books available on the server.
    pub book_count: Option<u32>,
}

/// Result of a sync operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    /// Number of books added to the library.
    pub books_added: u32,
    /// Number of progress records synced.
    pub progress_synced: u32,
    /// Any errors that occurred during sync.
    pub errors: Vec<String>,
}

/// Server info response for GET /info endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    /// Server name.
    pub name: String,
    /// Number of books with narration available.
    pub book_count: u32,
    /// Server version for compatibility checking.
    pub version: String,
    /// Identifier for Actual Reader servers.
    pub server_type: String,
}

/// Book info for the book list endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookInfo {
    /// Book ID.
    pub id: String,
    /// Book title.
    pub title: String,
    /// Book author.
    pub author: Option<String>,
    /// Source format.
    pub source_format: String,
    /// Whether the book has narration.
    pub has_narration: bool,
}

/// Shared state for the sync HTTP server.
#[derive(Clone)]
struct SyncServerState {
    db: Arc<crate::storage::Database>,
    paths: AppPaths,
    server_name: String,
}

/// Get information about the sync server.
async fn handle_get_info(AxumState(state): AxumState<SyncServerState>) -> impl IntoResponse {
    let book_count = match get_narrated_book_count(&state) {
        Ok(count) => count,
        Err(e) => {
            log::error!("Failed to get book count: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e})),
            );
        }
    };

    (
        StatusCode::OK,
        Json(serde_json::json!(ServerInfo {
            name: state.server_name.clone(),
            book_count,
            version: env!("CARGO_PKG_VERSION").to_string(),
            server_type: "actual-reader".to_string(),
        })),
    )
}

/// Get count of books with narration.
fn get_narrated_book_count(state: &SyncServerState) -> Result<u32, String> {
    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM books WHERE narration_status = 'ready'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count books: {}", e))?;

    Ok(count as u32)
}

/// Get list of books available for sync.
async fn handle_get_books(AxumState(state): AxumState<SyncServerState>) -> impl IntoResponse {
    let books = match get_narrated_books(&state) {
        Ok(books) => books,
        Err(e) => {
            log::error!("Failed to get books: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e})),
            );
        }
    };

    (StatusCode::OK, Json(serde_json::json!({ "books": books })))
}

/// Get all books with narration ready.
fn get_narrated_books(state: &SyncServerState) -> Result<Vec<BookInfo>, String> {
    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, author, source_format, narration_status
             FROM books
             WHERE narration_status = 'ready'
             ORDER BY title",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let books = stmt
        .query_map([], |row| {
            Ok(BookInfo {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                source_format: row.get(3)?,
                has_narration: row.get::<_, String>(4)? == "ready",
            })
        })
        .map_err(|e| format!("Failed to query books: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read book row: {}", e))?;

    Ok(books)
}

/// Download a book as an .actualbook bundle.
async fn handle_get_book(
    AxumPath(book_id): AxumPath<String>,
    AxumState(state): AxumState<SyncServerState>,
) -> impl IntoResponse {
    // Create the bundle in memory
    let bundle_data = match create_book_bundle(&state, &book_id) {
        Ok(data) => data,
        Err(e) => {
            log::error!("Failed to create bundle for book {}: {}", book_id, e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                vec![],
            )
                .into_response();
        }
    };

    (
        StatusCode::OK,
        [
            ("content-type", "application/octet-stream"),
            (
                "content-disposition",
                &format!("attachment; filename=\"{}.actualbook\"", book_id),
            ),
        ],
        bundle_data,
    )
        .into_response()
}

/// Create an .actualbook bundle for a book.
fn create_book_bundle(state: &SyncServerState, book_id: &str) -> Result<Vec<u8>, String> {
    use std::io::Write;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    // 1. Get book metadata
    let book: Book = conn
        .query_row(
            "SELECT id, title, author, source_format, source_path, narration_status, narration_path, created_at, updated_at, last_opened_at
             FROM books WHERE id = ?1",
            [book_id],
            |row| {
                let source_format_str: String = row.get(3)?;
                let narration_status_str: String = row.get(5)?;
                Ok(Book {
                    id: BookId::new(row.get::<_, String>(0)?),
                    title: row.get(1)?,
                    author: row.get(2)?,
                    source_format: SourceFormat::from_str(&source_format_str).unwrap_or(SourceFormat::Txt),
                    source_path: row.get(4)?,
                    narration_status: NarrationStatus::from_str(&narration_status_str).unwrap_or(NarrationStatus::None),
                    narration_path: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                    last_opened_at: row.get(9)?,
                })
            },
        )
        .map_err(|e| format!("Book not found: {}", e))?;

    // Check if narration is ready
    if book.narration_status != NarrationStatus::Ready {
        return Err("Book does not have narration ready".to_string());
    }

    // 2. Get segments
    let segments: Vec<serde_json::Value> = {
        let mut stmt = conn
            .prepare("SELECT id, idx, content, html FROM segments WHERE book_id = ?1 ORDER BY idx")
            .map_err(|e| format!("Failed to prepare segments query: {}", e))?;

        let result = stmt.query_map([book_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "index": row.get::<_, i64>(1)?,
                "content": row.get::<_, String>(2)?,
                "html": row.get::<_, Option<String>>(3)?
            }))
        })
        .map_err(|e| format!("Failed to query segments: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read segment: {}", e))?;
        result
    };

    // 3. Get markers
    let markers: Vec<serde_json::Value> = {
        let mut stmt = conn
            .prepare("SELECT segment_id, start_time, end_time FROM markers WHERE book_id = ?1 ORDER BY start_time")
            .map_err(|e| format!("Failed to prepare markers query: {}", e))?;

        let result = stmt.query_map([book_id], |row| {
            Ok(serde_json::json!({
                "segment_id": row.get::<_, String>(0)?,
                "start": row.get::<_, f64>(1)?,
                "end": row.get::<_, f64>(2)?
            }))
        })
        .map_err(|e| format!("Failed to query markers: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read marker: {}", e))?;
        result
    };

    // Calculate duration from markers
    let duration: f64 = markers
        .iter()
        .filter_map(|m| m.get("end").and_then(|e| e.as_f64()))
        .fold(0.0, f64::max);

    // 4. Create manifest
    let manifest = serde_json::json!({
        "version": "1.0",
        "id": book.id.as_str(),
        "title": book.title,
        "author": book.author,
        "source_format": book.source_format.as_str(),
        "created_at": book.created_at,
        "duration": duration,
        "segment_count": segments.len()
    });

    // 5. Create ZIP archive in memory
    let mut buffer = std::io::Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut buffer);
        let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        // Write manifest.json
        zip.start_file("manifest.json", options)
            .map_err(|e| format!("Failed to create manifest.json: {}", e))?;
        let manifest_bytes = serde_json::to_vec_pretty(&manifest)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
        zip.write_all(&manifest_bytes)
            .map_err(|e| format!("Failed to write manifest: {}", e))?;

        // Write content/segments.json
        zip.start_file("content/segments.json", options)
            .map_err(|e| format!("Failed to create segments.json: {}", e))?;
        let segments_json = serde_json::json!({ "segments": segments });
        let segments_bytes = serde_json::to_vec_pretty(&segments_json)
            .map_err(|e| format!("Failed to serialize segments: {}", e))?;
        zip.write_all(&segments_bytes)
            .map_err(|e| format!("Failed to write segments: {}", e))?;

        // Write narration/markers.json
        zip.start_file("narration/markers.json", options)
            .map_err(|e| format!("Failed to create markers.json: {}", e))?;
        let markers_json = serde_json::json!({ "markers": markers });
        let markers_bytes = serde_json::to_vec_pretty(&markers_json)
            .map_err(|e| format!("Failed to serialize markers: {}", e))?;
        zip.write_all(&markers_bytes)
            .map_err(|e| format!("Failed to write markers: {}", e))?;

        // Write narration/audio.mp3 if it exists
        let audio_path = state.paths.narration_audio_path(book_id);
        if audio_path.exists() {
            zip.start_file("narration/audio.mp3", options)
                .map_err(|e| format!("Failed to create audio.mp3: {}", e))?;
            let audio_data = std::fs::read(&audio_path)
                .map_err(|e| format!("Failed to read audio file: {}", e))?;
            zip.write_all(&audio_data)
                .map_err(|e| format!("Failed to write audio: {}", e))?;
        }

        zip.finish()
            .map_err(|e| format!("Failed to finish ZIP: {}", e))?;
    }

    Ok(buffer.into_inner())
}

/// Get the local IP address to bind to.
fn get_local_ip() -> String {
    // Try to get a non-loopback IPv4 address
    if let Ok(interfaces) = std::net::UdpSocket::bind("0.0.0.0:0") {
        // Connect to a remote address to determine local IP
        if interfaces.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = interfaces.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    // Fallback to binding on all interfaces
    "0.0.0.0".to_string()
}

/// Get the server name (hostname or default).
fn get_server_name() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Actual Reader Desktop".to_string())
}

/// Start the sync server (desktop only).
///
/// Starts an HTTP server on the local network that mobile devices can connect to.
/// The server provides:
/// - mDNS discovery (automatic)
/// - Book list endpoint
/// - Bundle download endpoints
/// - Progress sync endpoint
#[tauri::command]
pub async fn start_sync_server(state: State<'_, AppState>) -> Result<SyncServer, String> {
    // Check if server is already running
    {
        let server_guard = state.sync_server.read().await;
        if server_guard.is_some() {
            return Err("Sync server is already running".to_string());
        }
    }

    // 1. Get configured port from settings
    let port: u16 = {
        let conn = state.db.connection().lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT value FROM settings WHERE key = 'syncPort'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(42069)
    };

    let server_name = get_server_name();
    let local_ip = get_local_ip();

    // 2. Create shared state for HTTP handlers
    let sync_state = SyncServerState {
        db: state.db.clone(),
        paths: state.paths.clone(),
        server_name: server_name.clone(),
    };

    // 3. Build the HTTP router
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/info", get(handle_get_info))
        .route("/books", get(handle_get_books))
        .route("/book/{id}", get(handle_get_book))
        .layer(cors)
        .with_state(sync_state);

    // 4. Create shutdown channel
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    // 5. Start HTTP server
    let addr: SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;

    let actual_port = listener
        .local_addr()
        .map(|a| a.port())
        .unwrap_or(port);

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .ok();
    });

    log::info!("Sync server started on port {}", actual_port);

    // 6. Register mDNS service
    let mdns = ServiceDaemon::new().map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

    // Create service info
    let instance_name = format!("{}-{}", server_name.replace(' ', "-"), Uuid::new_v4().to_string()[..8].to_string());

    // Get all local IPs for mDNS registration
    let host_ipv4 = if local_ip != "0.0.0.0" {
        local_ip.clone()
    } else {
        "127.0.0.1".to_string()
    };

    let service_info = ServiceInfo::new(
        MDNS_SERVICE_TYPE,
        &instance_name,
        &format!("{}.local.", instance_name),
        &host_ipv4,
        actual_port,
        None,
    )
    .map_err(|e| format!("Failed to create mDNS service info: {}", e))?;

    let service_fullname = service_info.get_fullname().to_string();

    mdns.register(service_info)
        .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

    log::info!("mDNS service registered: {}", service_fullname);

    // 7. Store server handle
    {
        let mut server_guard = state.sync_server.write().await;
        *server_guard = Some(crate::SyncServerHandle {
            shutdown_tx,
            mdns_daemon: mdns,
            service_fullname,
        });
    }

    // 8. Return server info
    Ok(SyncServer {
        name: server_name,
        address: if local_ip == "0.0.0.0" {
            "127.0.0.1".to_string()
        } else {
            local_ip
        },
        port: actual_port,
        book_count: None,
    })
}

/// Stop the sync server.
#[tauri::command]
pub async fn stop_sync_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut server_guard = state.sync_server.write().await;

    if let Some(handle) = server_guard.take() {
        // 1. Unregister mDNS service
        handle
            .mdns_daemon
            .unregister(&handle.service_fullname)
            .map_err(|e| format!("Failed to unregister mDNS service: {}", e))?;

        // Shutdown mDNS daemon
        handle
            .mdns_daemon
            .shutdown()
            .map_err(|e| format!("Failed to shutdown mDNS daemon: {}", e))?;

        // 2. Signal HTTP server to shutdown
        let _ = handle.shutdown_tx.send(());

        log::info!("Sync server stopped");
        Ok(())
    } else {
        Err("Sync server is not running".to_string())
    }
}

/// Discover sync servers on the local network.
///
/// Uses mDNS to find other Actual Reader instances running sync servers.
/// Returns a list of discovered servers.
#[tauri::command]
pub async fn discover_sync_servers() -> Result<Vec<SyncServer>, String> {
    let mdns = ServiceDaemon::new().map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

    let receiver = mdns
        .browse(MDNS_SERVICE_TYPE)
        .map_err(|e| format!("Failed to browse mDNS services: {}", e))?;

    let mut servers: HashMap<String, SyncServer> = HashMap::new();

    // Listen for services for a short time
    let timeout = Duration::from_secs(3);
    let start = std::time::Instant::now();

    while start.elapsed() < timeout {
        match receiver.recv_timeout(Duration::from_millis(100)) {
            Ok(event) => match event {
                ServiceEvent::ServiceResolved(info) => {
                    let name = info.get_fullname().to_string();

                    // Get the first IPv4 address
                    let address = info
                        .get_addresses()
                        .iter()
                        .find(|addr| addr.is_ipv4())
                        .map(|addr| addr.to_string())
                        .unwrap_or_else(|| "127.0.0.1".to_string());

                    let server = SyncServer {
                        name: info.get_hostname().trim_end_matches('.').to_string(),
                        address,
                        port: info.get_port(),
                        book_count: None,
                    };

                    servers.insert(name, server);
                }
                ServiceEvent::ServiceRemoved(_, fullname) => {
                    servers.remove(&fullname);
                }
                _ => {}
            },
            Err(flume::RecvTimeoutError::Timeout) => continue,
            Err(_) => break,
        }
    }

    // Stop browsing
    mdns.stop_browse(MDNS_SERVICE_TYPE).ok();
    mdns.shutdown().ok();

    Ok(servers.into_values().collect())
}

/// Connect to a sync server manually by address.
///
/// Used when mDNS discovery doesn't work (e.g., complex networks, VLANs).
#[tauri::command]
pub async fn connect_to_server(address: String, port: u16) -> Result<SyncServer, String> {
    let url = format!("http://{}:{}/info", address, port);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to server: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Server returned error: {}",
            response.status()
        ));
    }

    let info: ServerInfo = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse server response: {}", e))?;

    // Verify it's an Actual Reader server
    if info.server_type != "actual-reader" {
        return Err("Not an Actual Reader server".to_string());
    }

    Ok(SyncServer {
        name: info.name,
        address,
        port,
        book_count: Some(info.book_count),
    })
}

/// Sync with a server.
///
/// Transfers books and progress between this device and the server.
/// The sync is bidirectional:
/// - Books with narration are transferred as bundles
/// - Progress is merged (most recent wins)
#[tauri::command]
pub async fn sync_with_server(
    server: SyncServer,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncResult, String> {
    let mut result = SyncResult {
        books_added: 0,
        progress_synced: 0,
        errors: Vec::new(),
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300)) // 5 minute timeout for large files
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // 1. GET /books from server
    let books_url = format!("http://{}:{}/books", server.address, server.port);
    let response = client
        .get(&books_url)
        .send()
        .await
        .map_err(|e| format!("Failed to get book list: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to get book list: {}",
            response.status()
        ));
    }

    #[derive(Deserialize)]
    struct BooksResponse {
        books: Vec<BookInfo>,
    }

    let books_response: BooksResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse book list: {}", e))?;

    // 2. Compare with local library
    let local_book_ids: std::collections::HashSet<String> = {
        let conn = state.db.connection().lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM books")
            .map_err(|e| format!("Failed to query local books: {}", e))?;

        let result = stmt.query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to read books: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        result
    };

    let books_to_download: Vec<&BookInfo> = books_response
        .books
        .iter()
        .filter(|book| !local_book_ids.contains(&book.id) && book.has_narration)
        .collect();

    let total_books = books_to_download.len();

    // 3. Download and import each missing book
    for (index, book_info) in books_to_download.iter().enumerate() {
        // Emit progress event
        let progress = ((index as f64) / (total_books as f64) * 100.0) as u32;
        app.emit("sync_progress", serde_json::json!({
            "percent": progress,
            "current": index + 1,
            "total": total_books,
            "book_title": book_info.title
        }))
        .ok();

        // Download bundle
        let book_url = format!(
            "http://{}:{}/book/{}",
            server.address, server.port, book_info.id
        );

        match download_and_import_book(&client, &book_url, &state).await {
            Ok(_) => {
                result.books_added += 1;
                log::info!("Imported book: {}", book_info.title);
            }
            Err(e) => {
                let error = format!("Failed to import '{}': {}", book_info.title, e);
                log::error!("{}", error);
                result.errors.push(error);
            }
        }
    }

    // Emit completion
    app.emit("sync_progress", serde_json::json!({
        "percent": 100,
        "current": total_books,
        "total": total_books,
        "complete": true
    }))
    .ok();

    Ok(result)
}

/// Download a book bundle and import it into the local library.
async fn download_and_import_book(
    client: &reqwest::Client,
    url: &str,
    state: &AppState,
) -> Result<(), String> {
    // Download the bundle
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned: {}", response.status()));
    }

    let bundle_data = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Import the bundle
    import_bundle_data(&bundle_data, state)
}

/// Import a book from bundle data.
fn import_bundle_data(data: &[u8], state: &AppState) -> Result<(), String> {
    use std::io::Cursor;
    use zip::ZipArchive;

    let cursor = Cursor::new(data);
    let mut archive =
        ZipArchive::new(cursor).map_err(|e| format!("Invalid bundle archive: {}", e))?;

    // 1. Read and parse manifest.json
    let manifest: serde_json::Value = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|e| format!("Missing manifest.json: {}", e))?;
        let mut contents = String::new();
        manifest_file
            .read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
        serde_json::from_str(&contents).map_err(|e| format!("Invalid manifest JSON: {}", e))?
    };

    let book_id = manifest
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("Missing id in manifest")?;
    let title = manifest
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or("Missing title in manifest")?;
    let author = manifest.get("author").and_then(|v| v.as_str());
    let source_format_str = manifest
        .get("source_format")
        .and_then(|v| v.as_str())
        .unwrap_or("txt");
    let created_at = manifest
        .get("created_at")
        .and_then(|v| v.as_i64())
        .unwrap_or_else(|| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64
        });

    // 2. Read segments
    #[derive(Deserialize)]
    struct SegmentsFile {
        segments: Vec<serde_json::Value>,
    }

    let segments: SegmentsFile = {
        let mut segments_file = archive
            .by_name("content/segments.json")
            .map_err(|e| format!("Missing segments.json: {}", e))?;
        let mut contents = String::new();
        segments_file
            .read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read segments: {}", e))?;
        serde_json::from_str(&contents).map_err(|e| format!("Invalid segments JSON: {}", e))?
    };

    // 3. Read markers
    #[derive(Deserialize)]
    struct MarkersFile {
        markers: Vec<serde_json::Value>,
    }

    let markers: MarkersFile = {
        let mut markers_file = archive
            .by_name("narration/markers.json")
            .map_err(|e| format!("Missing markers.json: {}", e))?;
        let mut contents = String::new();
        markers_file
            .read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read markers: {}", e))?;
        serde_json::from_str(&contents).map_err(|e| format!("Invalid markers JSON: {}", e))?
    };

    // 4. Extract audio file
    let narration_dir = state.paths.narration_path(book_id);
    std::fs::create_dir_all(&narration_dir)
        .map_err(|e| format!("Failed to create narration directory: {}", e))?;

    let audio_path = state.paths.narration_audio_path(book_id);
    if let Ok(mut audio_file) = archive.by_name("narration/audio.mp3") {
        let mut audio_data = Vec::new();
        audio_file
            .read_to_end(&mut audio_data)
            .map_err(|e| format!("Failed to read audio: {}", e))?;
        std::fs::write(&audio_path, &audio_data)
            .map_err(|e| format!("Failed to write audio file: {}", e))?;
    }

    // 5. Insert into database
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let conn = state.db.connection().lock().map_err(|e| e.to_string())?;

    // Insert book
    conn.execute(
        "INSERT OR REPLACE INTO books (id, title, author, source_format, source_path, narration_status, narration_path, created_at, updated_at, last_opened_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL)",
        rusqlite::params![
            book_id,
            title,
            author,
            source_format_str,
            "", // No source file for imported bundles
            "ready",
            narration_dir.to_string_lossy().to_string(),
            created_at,
            now,
        ],
    )
    .map_err(|e| format!("Failed to insert book: {}", e))?;

    // Insert segments
    let mut stmt = conn
        .prepare("INSERT OR REPLACE INTO segments (id, book_id, idx, content, html) VALUES (?1, ?2, ?3, ?4, ?5)")
        .map_err(|e| format!("Failed to prepare segment insert: {}", e))?;

    for segment in &segments.segments {
        let seg_id = segment.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let index = segment.get("index").and_then(|v| v.as_i64()).unwrap_or(0);
        let content = segment.get("content").and_then(|v| v.as_str()).unwrap_or("");
        let html = segment.get("html").and_then(|v| v.as_str());

        stmt.execute(rusqlite::params![seg_id, book_id, index, content, html])
            .map_err(|e| format!("Failed to insert segment: {}", e))?;
    }

    // Insert markers
    let mut stmt = conn
        .prepare("INSERT OR REPLACE INTO markers (id, book_id, segment_id, start_time, end_time) VALUES (?1, ?2, ?3, ?4, ?5)")
        .map_err(|e| format!("Failed to prepare marker insert: {}", e))?;

    for marker in &markers.markers {
        let segment_id = marker
            .get("segment_id")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let start = marker.get("start").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let end = marker.get("end").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let marker_id = format!("mrk_{}", Uuid::new_v4());

        stmt.execute(rusqlite::params![marker_id, book_id, segment_id, start, end])
            .map_err(|e| format!("Failed to insert marker: {}", e))?;
    }

    Ok(())
}

/// Get the current sync server status.
#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<Option<SyncServer>, String> {
    let server_guard = state.sync_server.read().await;

    if server_guard.is_some() {
        // Server is running, get its info
        let port: u16 = {
            let conn = state.db.connection().lock().map_err(|e| e.to_string())?;
            conn.query_row(
                "SELECT value FROM settings WHERE key = 'syncPort'",
                [],
                |row| row.get::<_, String>(0),
            )
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(42069)
        };

        Ok(Some(SyncServer {
            name: get_server_name(),
            address: get_local_ip(),
            port,
            book_count: None,
        }))
    } else {
        Ok(None)
    }
}
