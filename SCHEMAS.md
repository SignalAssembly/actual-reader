# Schemas

Exact data structures for Actual Reader. All JSON must validate against these schemas.

---

## TypeScript Types (Frontend)

```typescript
// Core types - use these exactly

type BookId = string;        // UUID v4
type SegmentId = string;     // "seg_" + UUID v4
type VoiceId = string;       // "voice_" + UUID v4
type Timestamp = number;     // Unix timestamp (seconds)
type Duration = number;      // Seconds (float)

type SourceFormat = 'epub' | 'markdown' | 'pdf';
type NarrationStatus = 'none' | 'generating' | 'ready';
type Engine = 'chatterbox' | 'piper' | 'elevenlabs';

interface Book {
    id: BookId;
    title: string;
    author: string | null;
    sourceFormat: SourceFormat;
    sourcePath: string;
    narrationStatus: NarrationStatus;
    narrationPath: string | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastOpenedAt: Timestamp | null;  // NULL if never opened, for "Recent" section
}

interface Segment {
    id: SegmentId;
    bookId: BookId;
    index: number;           // 0-based position
    content: string;         // Plain text
    html: string | null;     // Optional HTML rendering
}

interface Marker {
    segmentId: SegmentId;
    start: Duration;         // Start time in narration
    end: Duration;           // End time in narration
}

interface Progress {
    bookId: BookId;
    segmentIndex: number;    // Current segment
    audioTime: Duration | null;  // Position in narration
    updatedAt: Timestamp;
}

interface Voice {
    id: VoiceId;
    name: string;
    engine: Engine;
    samplePath: string | null;  // Voice sample for cloning
    isDefault: boolean;
}

interface Library {
    books: Book[];
}

interface SyncServer {
    name: string;            // Device name
    address: string;         // IP address
    port: number;
}

interface SyncResult {
    booksAdded: number;
    progressSynced: number;
    errors: string[];
}
```

---

## Rust Types (Backend)

```rust
use serde::{Deserialize, Serialize};

// Newtype wrappers for type safety
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct BookId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SegmentId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct VoiceId(pub String);

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceFormat {
    Epub,
    Markdown,
    Pdf,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NarrationStatus {
    None,
    Generating,
    Ready,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Engine {
    Chatterbox,
    Piper,
    Elevenlabs,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: BookId,
    pub title: String,
    pub author: Option<String>,
    pub source_format: SourceFormat,
    pub source_path: String,
    pub narration_status: NarrationStatus,
    pub narration_path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_opened_at: Option<i64>,  // None if never opened
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: SegmentId,
    pub book_id: BookId,
    pub index: u32,
    pub content: String,
    pub html: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Marker {
    pub segment_id: SegmentId,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub book_id: BookId,
    pub segment_index: u32,
    pub audio_time: Option<f64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Voice {
    pub id: VoiceId,
    pub name: String,
    pub engine: Engine,
    pub sample_path: Option<String>,
    pub is_default: bool,
}
```

---

## Bundle Manifest (manifest.json)

```json
{
    "$schema": "https://actualreader.dev/schemas/manifest-1.0.json",
    "version": "1.0",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "sourceFormat": "epub",
    "createdAt": 1705334400,
    "voice": {
        "name": "Rocket Scientist",
        "engine": "chatterbox"
    },
    "narration": {
        "duration": 32580.5,
        "segmentCount": 1247
    },
    "checksum": "sha256:abcdef1234567890..."
}
```

### Schema Rules

- `version`: Always "1.0" for this format version
- `id`: UUID v4, unique per bundle
- `title`: Required, non-empty string
- `author`: Optional, null if unknown
- `sourceFormat`: One of "epub", "markdown", "pdf"
- `createdAt`: Unix timestamp (seconds)
- `voice.name`: Display name of voice
- `voice.engine`: One of "chatterbox", "piper", "elevenlabs"
- `narration.duration`: Total seconds (float)
- `narration.segmentCount`: Number of segments (integer)
- `checksum`: SHA-256 of audio file, prefixed with "sha256:"

---

## Segments File (content/segments.json)

```json
{
    "$schema": "https://actualreader.dev/schemas/segments-1.0.json",
    "segments": [
        {
            "id": "seg_550e8400-e29b-41d4-a716-446655440001",
            "index": 0,
            "content": "Chapter 1",
            "html": "<h1>Chapter 1</h1>"
        },
        {
            "id": "seg_550e8400-e29b-41d4-a716-446655440002",
            "index": 1,
            "content": "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.",
            "html": "<p>In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.</p>"
        }
    ]
}
```

### Schema Rules

- `segments`: Array, ordered by index
- `id`: Unique segment ID, format "seg_" + UUID
- `index`: 0-based, sequential, no gaps
- `content`: Plain text, whitespace normalized
- `html`: Optional, valid HTML fragment

---

## Markers File (narration/markers.json)

```json
{
    "$schema": "https://actualreader.dev/schemas/markers-1.0.json",
    "markers": [
        {
            "segmentId": "seg_550e8400-e29b-41d4-a716-446655440001",
            "start": 0.0,
            "end": 1.2
        },
        {
            "segmentId": "seg_550e8400-e29b-41d4-a716-446655440002",
            "start": 1.2,
            "end": 8.7
        }
    ]
}
```

### Schema Rules

- `markers`: Array, ordered by start time
- `segmentId`: Must reference valid segment ID
- `start`: Seconds (float), >= 0
- `end`: Seconds (float), > start
- No gaps: each marker.end should equal next marker.start
- Last marker.end should equal total duration

---

## TTS Bridge Protocol

### Generate Request

```json
{
    "type": "generate",
    "id": "req_001",
    "text": "Hello, world.",
    "voice": {
        "engine": "chatterbox",
        "sample": "/path/to/voice.wav"
    },
    "options": {
        "exaggeration": 0.3
    }
}
```

### Audio Response

```json
{
    "type": "audio",
    "id": "req_001",
    "path": "/tmp/actual_tts_001.wav",
    "duration": 1.5
}
```

### Progress Event

```json
{
    "type": "progress",
    "percent": 45,
    "message": "Generating segment 45/100"
}
```

### Error Response

```json
{
    "type": "error",
    "id": "req_001",
    "code": "OUT_OF_MEMORY",
    "message": "CUDA out of memory. Try reducing batch size."
}
```

### Shutdown Request

```json
{
    "type": "shutdown"
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| `OUT_OF_MEMORY` | GPU/system memory exhausted |
| `VOICE_NOT_FOUND` | Voice sample file missing |
| `INVALID_TEXT` | Text too long or empty |
| `ENGINE_ERROR` | TTS engine internal error |
| `CANCELLED` | Generation was cancelled |

---

## Settings Keys

Stored in `settings` table as key-value pairs.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `theme` | `"light" \| "dark" \| "system"` | `"system"` | UI theme |
| `font_size` | `number` | `16` | Reader font size (px) |
| `font_family` | `string` | `"system"` | Reader font |
| `line_height` | `number` | `1.6` | Line height multiplier |
| `playback_speed` | `number` | `1.0` | Narration speed (0.5-2.0) |
| `highlight_color` | `string` | `"#ffeb3b"` | Segment highlight color |
| `default_voice` | `VoiceId \| null` | `null` | Default voice for generation |
| `auto_play` | `boolean` | `false` | Auto-play on book open |
| `sync_port` | `number` | `42069` | Local sync server port |

---

## ID Generation

All IDs use UUID v4 with prefixes:

```
Book ID:     "550e8400-e29b-41d4-a716-446655440000"
Segment ID:  "seg_550e8400-e29b-41d4-a716-446655440001"
Voice ID:    "voice_550e8400-e29b-41d4-a716-446655440002"
Request ID:  "req_001"  (sequential within session)
```

### Why Prefixes for Some

- `seg_` and `voice_` prefixes make logs readable
- Book IDs are used in URLs, keep them clean
- Request IDs are ephemeral, simple counter is fine
