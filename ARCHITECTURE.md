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
│  │                         FRONTEND (Solid.js)                            │   │
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
│  │  ├── covers/             # Extracted book cover thumbnails          │   │
│  │  ├── narration/          # Generated audio files                    │   │
│  │  ├── voices/             # Voice samples for cloning                │   │
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
│  │                         FRONTEND (Solid.js)                            │   │
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

### Frontend Modules (Solid.js)

```
src/
├── components/           # Reusable UI components
│   ├── BookCard.tsx
│   ├── NarrationPlayer.tsx
│   ├── ProgressBar.tsx
│   ├── VoiceSelector.tsx
│   ├── TtsControls.tsx
│   ├── ImportModal.tsx
│   └── ...
├── views/                # Top-level views (pages)
│   ├── LibraryView.tsx
│   ├── ReaderView.tsx
│   ├── GeneratorView.tsx    # Desktop only, TTS controls + queue
│   └── SettingsView.tsx
├── stores/               # Solid.js stores (reactive state)
│   ├── libraryStore.ts
│   ├── readerStore.ts
│   ├── settingsStore.ts
│   └── voiceStore.ts
├── tauri/                # Tauri IPC bindings
│   ├── commands.ts
│   └── events.ts
└── types/                # TypeScript types
    └── index.ts
```

**Note:** Solid.js uses stores instead of React hooks. No virtual DOM, fine-grained reactivity.

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
│   │   │   ├── txt.rs
│   │   │   └── pdf.rs
│   │   ├── tts.rs        # TTS bridge, desktop only
│   │   ├── vision.rs     # Image captioning, desktop only
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
│ First Import? │──── Yes ───► Show Import Modal
└───────┬───────┘              ┌─────────────────┐
        │ No                   │ "Process Now"   │
        │                      │ "Just Import"   │
        │                      │ [x] Don't show  │
        │                      └────────┬────────┘
        │◄──────────────────────────────┘
        ▼
┌───────────────┐
│ Parser Service│ ─── Detects format (EPUB/MD/TXT/PDF)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Extract Text  │ ─── Converts to segments (text + images)
│ + Images      │     Images stored as image segments
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Library Mgr   │ ─── Saves to SQLite + copies source
└───────┬───────┘
        │
        ├──── "Just Import" ────► Book appears (📖 text-only)
        │
        └──── "Process Now" ────► Start Generation (background)
```

### Generate Narration

```
User clicks "Generate" (or auto-process on import)
        │
        ▼
┌───────────────┐
│ Stage 1:      │ ─── Find all image segments
│ EXTRACTING    │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Stage 2:      │ ─── Qwen2.5-VL generates captions
│ CAPTIONING    │     "Second image on page 87..."
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Stage 3:      │ ─── Chatterbox generates audio
│ NARRATING     │     Text segments + image captions
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Stage 4:      │ ─── Concatenate audio, save markers
│ FINALIZING    │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Storage       │ ─── Saves .wav + updates markers in DB
└───────┬───────┘
        │
        ▼
Book now has narration (🎧 ready)
```

### Library Status Indicators

```
📖 text-only   ─── Book imported, no narration
⏳ processing  ─── Narration being generated (background)
🎧 ready       ─── Narration complete, can play
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
   │  │ Sync Server (HTTP + mDNS)   │   │
   │  │ Listens on local network    │   │
   │  └──────────────┬──────────────┘   │
   │                 │                   │
   │    ◄─── Discovery (mDNS) ────►     │
   │    ◄── OR manual IP entry ────►    │
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

**Note:** mDNS discovery is convenience, not required. Users can always enter the desktop's IP address manually. This handles complex networks (VLANs, corporate firewalls) where mDNS doesn't work.

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
invoke('generate_narration', {
    bookId: string,
    voiceId: string,
    exaggeration: number,  // 0-10
    cfgWeight: number,     // 0-3
    temperature: number    // 0-5
}): Promise<void>
invoke('generate_quick_audio', {
    text: string,
    voiceId: string,
    exaggeration: number,
    cfgWeight: number,
    temperature: number
}): Promise<Uint8Array>    // Returns WAV audio data
invoke('get_voices'): Promise<Voice[]>
invoke('create_voice', { name: string, samplePath: string }): Promise<Voice>
invoke('delete_voice', { voiceId: string }): Promise<void>
invoke('set_default_voice', { voiceId: string }): Promise<void>
invoke('get_presets'): Promise<Preset[]>
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
    source_format TEXT NOT NULL,  -- 'epub', 'markdown', 'txt', 'pdf'
    source_path TEXT NOT NULL,
    cover_path TEXT,             -- Extracted cover thumbnail (NULL if none)
    narration_status TEXT NOT NULL DEFAULT 'none',  -- 'none', 'generating', 'ready'
    narration_path TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_opened_at INTEGER       -- NULL if never opened, for "Recent" section
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
    -- engine is always 'chatterbox', no column needed
    sample_path TEXT NOT NULL,  -- Path to voice sample for cloning
    is_default INTEGER NOT NULL DEFAULT 0,
    is_custom INTEGER NOT NULL DEFAULT 1  -- 0 = shipped with app, 1 = user-created
);

-- TTS Presets
CREATE TABLE presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    exaggeration REAL NOT NULL DEFAULT 0.5,
    cfg_weight REAL NOT NULL DEFAULT 0.5,
    temperature REAL NOT NULL DEFAULT 0.8,
    is_global INTEGER NOT NULL DEFAULT 1,  -- 1 = applies to any voice
    voice_id TEXT REFERENCES voices(id) ON DELETE CASCADE,  -- NULL if global
    is_default INTEGER NOT NULL DEFAULT 0  -- 0 = user-created, 1 = shipped with app
);

-- Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Default presets (shipped with app)
-- INSERT INTO presets VALUES ('preset_robot', 'Robot', 0.05, 0.7, 0.5, 1, NULL, 1);
-- INSERT INTO presets VALUES ('preset_calm', 'Calm', 0.25, 0.5, 0.7, 1, NULL, 1);
-- INSERT INTO presets VALUES ('preset_default', 'Default', 0.5, 0.5, 0.8, 1, NULL, 1);
-- INSERT INTO presets VALUES ('preset_expressive', 'Expressive', 0.8, 0.4, 0.9, 1, NULL, 1);
-- INSERT INTO presets VALUES ('preset_dramatic', 'Dramatic', 1.2, 0.3, 1.0, 1, NULL, 1);
-- INSERT INTO presets VALUES ('preset_unhinged', 'Unhinged', 2.0, 0.2, 1.3, 1, NULL, 1);
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
│   ├── audio.wav       # Full narration audio
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
        "name": "Rocket Scientist"
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
