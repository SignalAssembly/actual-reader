# Architecture

Technical architecture for Actual Reader.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DESKTOP APP                                    │
│                         (Windows, Mac, Linux)                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (React)                            │   │
│  │                                                                     │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │   │
│  │  │  Library  │  │  Reader   │  │ Generator │  │   Settings    │   │   │
│  │  │   View    │  │   View    │  │   View    │  │     View      │   │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                            │
│                         Tauri IPC                                           │
│                                │                                            │
│  ┌─────────────────────────────┴───────────────────────────────────────┐   │
│  │                         BACKEND (Rust)                              │   │
│  │                                                                     │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │   │
│  │  │  Library  │  │  Parser   │  │   Sync    │  │    Bundle     │   │   │
│  │  │  Manager  │  │  Service  │  │  Server   │  │    Service    │   │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────────┘   │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    TTS Bridge (subprocess)                   │   │   │
│  │  │                                                              │   │   │
│  │  │   Rust  ←─── stdin/stdout ───→  Python (Chatterbox)         │   │   │
│  │  │                                                              │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         STORAGE (SQLite + Files)                    │   │
│  │                                                                     │   │
│  │  ~/ActualReader/                                                    │   │
│  │  ├── library.db          # SQLite: books, progress, settings       │   │
│  │  ├── sources/            # Original imported files                  │   │
│  │  ├── narration/          # Generated audio files                    │   │
│  │  └── bundles/            # Exported .actualbook files               │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Local WiFi / Manual Transfer
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE APP                                     │
│                          (iOS, Android)                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (React)                            │   │
│  │                                                                     │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────────────┐   │   │
│  │  │  Library  │  │  Reader   │  │          Settings             │   │   │
│  │  │   View    │  │   View    │  │  (no Generator - read only)   │   │   │
│  │  └───────────┘  └───────────┘  └───────────────────────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                            │
│  ┌─────────────────────────────┴───────────────────────────────────────┐   │
│  │                         BACKEND (Rust)                              │   │
│  │                                                                     │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────────────┐   │   │
│  │  │  Library  │  │  Bundle   │  │         Sync Client           │   │   │
│  │  │  Manager  │  │  Loader   │  │   (connects to desktop)       │   │   │
│  │  └───────────┘  └───────────┘  └───────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  NO TTS BRIDGE - mobile cannot generate narration                   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### Frontend Modules (React)

```
src/
├── components/           # Reusable UI components
│   ├── BookCard.tsx
│   ├── NarrationPlayer.tsx
│   ├── ProgressBar.tsx
│   └── ...
├── views/                # Top-level views (pages)
│   ├── LibraryView.tsx
│   ├── ReaderView.tsx
│   ├── GeneratorView.tsx    # Desktop only
│   └── SettingsView.tsx
├── hooks/                # React hooks
│   ├── useLibrary.ts
│   ├── useNarration.ts
│   └── useSync.ts
├── stores/               # State management
│   ├── libraryStore.ts
│   ├── readerStore.ts
│   └── settingsStore.ts
├── tauri/                # Tauri IPC bindings
│   ├── commands.ts
│   └── events.ts
└── types/                # TypeScript types
    └── index.ts
```

### Backend Modules (Rust)

```
src-tauri/
├── src/
│   ├── main.rs           # Entry point
│   ├── commands/         # Tauri command handlers
│   │   ├── library.rs
│   │   ├── parser.rs
│   │   ├── tts.rs        # Desktop only
│   │   ├── sync.rs
│   │   └── bundle.rs
│   ├── services/         # Business logic
│   │   ├── library.rs
│   │   ├── parser/
│   │   │   ├── epub.rs
│   │   │   ├── markdown.rs
│   │   │   └── pdf.rs
│   │   ├── tts.rs        # TTS bridge, desktop only
│   │   ├── sync.rs
│   │   └── bundle.rs
│   ├── models/           # Data structures
│   │   ├── book.rs
│   │   ├── segment.rs
│   │   ├── marker.rs
│   │   └── progress.rs
│   └── storage/          # Database and file access
│       ├── db.rs
│       └── files.rs
└── Cargo.toml
```

---

## Data Flow

### Import Book

```
User selects file
        │
        ▼
┌───────────────┐
│ Parser Service│ ─── Detects format (EPUB/MD/PDF)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Extract Text  │ ─── Converts to segments
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Library Mgr   │ ─── Saves to SQLite + copies source
└───────┬───────┘
        │
        ▼
Book appears in Library View
```

### Generate Narration

```
User clicks "Generate"
        │
        ▼
┌───────────────┐
│ TTS Bridge    │ ─── Spawns Python subprocess
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Chatterbox    │ ─── Generates audio per segment
└───────┬───────┘     (returns audio + markers)
        │
        ▼
┌───────────────┐
│ Storage       │ ─── Saves .mp3 + updates markers in DB
└───────┬───────┘
        │
        ▼
Book now has narration (play button appears)
```

### Play Narration

```
User opens book in Reader
        │
        ▼
┌───────────────┐
│ Reader View   │ ─── Loads segments + markers
└───────┬───────┘
        │
        ▼
User clicks play
        │
        ▼
┌───────────────┐
│ NarrationPlayer│ ─── HTML5 <audio> element
└───────┬───────┘
        │
        ├──── timeupdate event ────┐
        │                          │
        ▼                          ▼
┌───────────────┐         ┌───────────────┐
│ Update highlight│        │ Update progress│
└───────────────┘         └───────────────┘
```

### Export Bundle

```
User clicks "Export"
        │
        ▼
┌───────────────┐
│ Bundle Service│
└───────┬───────┘
        │
        ├── Reads book metadata
        ├── Reads segments
        ├── Reads markers
        ├── Copies narration audio
        │
        ▼
┌───────────────┐
│ Create ZIP    │ ─── Packages as .actualbook
└───────┬───────┘
        │
        ▼
User saves .actualbook file
```

### Sync (Local WiFi)

```
DESKTOP                              MOBILE
   │                                    │
   │  ┌─────────────────────────────┐   │
   │  │ Sync Server (mDNS/Bonjour)  │   │
   │  │ Listens on local network    │   │
   │  └──────────────┬──────────────┘   │
   │                 │                   │
   │    ◄────── Discovery ──────►       │
   │                 │                   │
   │  ┌──────────────┴──────────────┐   │
   │  │                             │   │
   │  │  "Desktop has 5 books"      │   │
   │  │  "Mobile has 3 books"       │   │
   │  │                             │   │
   │  │  Diff: 2 books to sync      │   │
   │  │                             │   │
   │  └──────────────┬──────────────┘   │
   │                 │                   │
   │    ────── Transfer bundles ─────►  │
   │                 │                   │
   │    ◄───── Sync progress ──────     │
   │                                    │
```

---

## Key Interfaces

### Tauri Commands (Frontend → Backend)

```typescript
// Library
invoke('import_book', { path: string }): Promise<Book>
invoke('get_library'): Promise<Book[]>
invoke('delete_book', { id: string }): Promise<void>

// Reader
invoke('get_book', { id: string }): Promise<Book>
invoke('get_segments', { bookId: string }): Promise<Segment[]>
invoke('save_progress', { bookId: string, progress: Progress }): Promise<void>

// TTS (desktop only)
invoke('generate_narration', { bookId: string, voiceId: string }): Promise<void>
invoke('get_voices'): Promise<Voice[]>
invoke('cancel_generation'): Promise<void>

// Bundle
invoke('export_bundle', { bookId: string, path: string }): Promise<void>
invoke('import_bundle', { path: string }): Promise<Book>

// Sync
invoke('start_sync_server'): Promise<void>
invoke('discover_sync_servers'): Promise<SyncServer[]>
invoke('sync_with', { server: SyncServer }): Promise<SyncResult>
```

### Tauri Events (Backend → Frontend)

```typescript
// TTS Progress
listen('generation_progress', (event: { bookId: string, percent: number }) => {})
listen('generation_complete', (event: { bookId: string }) => {})
listen('generation_error', (event: { bookId: string, error: string }) => {})

// Sync
listen('sync_discovered', (event: { server: SyncServer }) => {})
listen('sync_progress', (event: { percent: number }) => {})
```

---

## Storage Schema

### SQLite Tables

```sql
-- Books in library
CREATE TABLE books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    source_format TEXT NOT NULL,  -- 'epub', 'markdown', 'pdf'
    source_path TEXT NOT NULL,
    narration_status TEXT NOT NULL DEFAULT 'none',  -- 'none', 'generating', 'ready'
    narration_path TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Text segments
CREATE TABLE segments (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    index INTEGER NOT NULL,
    content TEXT NOT NULL,
    html TEXT,  -- Optional HTML rendering
    UNIQUE(book_id, index)
);

-- Narration markers
CREATE TABLE markers (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    start_time REAL NOT NULL,  -- seconds
    end_time REAL NOT NULL,    -- seconds
    UNIQUE(segment_id)
);

-- Reading progress
CREATE TABLE progress (
    book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    audio_time REAL,  -- seconds into narration
    updated_at INTEGER NOT NULL
);

-- Voices
CREATE TABLE voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    engine TEXT NOT NULL,  -- 'chatterbox', 'piper', etc.
    sample_path TEXT,      -- Path to voice sample for cloning
    is_default INTEGER NOT NULL DEFAULT 0
);

-- Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## Bundle Format (.actualbook)

A `.actualbook` file is a ZIP archive with this structure:

```
book.actualbook
├── manifest.json       # Metadata
├── content/
│   ├── segments.json   # Text segments
│   └── source.*        # Original file (optional)
├── narration/
│   ├── audio.mp3       # Full narration audio
│   └── markers.json    # Timing markers
└── assets/             # Images, fonts, etc. (optional)
    └── ...
```

### manifest.json

```json
{
    "version": "1.0",
    "id": "uuid",
    "title": "Book Title",
    "author": "Author Name",
    "source_format": "epub",
    "created_at": 1705334400,
    "voice": {
        "name": "Rocket Scientist",
        "engine": "chatterbox"
    },
    "duration": 3600.5,
    "segment_count": 150
}
```

### segments.json

```json
{
    "segments": [
        {
            "id": "seg_001",
            "index": 0,
            "content": "Chapter 1: The Beginning",
            "html": "<h1>Chapter 1: The Beginning</h1>"
        },
        {
            "id": "seg_002",
            "index": 1,
            "content": "It was a dark and stormy night...",
            "html": "<p>It was a dark and stormy night...</p>"
        }
    ]
}
```

### markers.json

```json
{
    "markers": [
        {
            "segment_id": "seg_001",
            "start": 0.0,
            "end": 2.5
        },
        {
            "segment_id": "seg_002",
            "start": 2.5,
            "end": 8.3
        }
    ]
}
```

---

## TTS Bridge Protocol

Communication between Rust backend and Python TTS subprocess via stdin/stdout JSON lines.

### Request (Rust → Python)

```json
{"type": "generate", "text": "Hello world", "voice": "rocket-scientist", "voice_sample": "/path/to/sample.wav"}
```

### Response (Python → Rust)

```json
{"type": "audio", "path": "/tmp/output_001.wav", "duration": 1.5}
```

### Progress (Python → Rust)

```json
{"type": "progress", "percent": 45}
```

### Error (Python → Rust)

```json
{"type": "error", "message": "Out of memory"}
```

---

## Security Considerations

1. **File Access**: Only access files within app data directory or user-selected paths
2. **Subprocess**: TTS subprocess runs with same permissions as app (no elevation)
3. **Network**: Sync server only binds to local interfaces, not public
4. **Input Validation**: Sanitize all file paths, reject path traversal attempts
5. **No Telemetry**: App does not phone home, no analytics, no crash reporting
