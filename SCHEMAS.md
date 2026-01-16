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

type SourceFormat = 'epub' | 'markdown' | 'txt' | 'pdf';
type NarrationStatus = 'none' | 'generating' | 'ready';
// TTS engine is always Chatterbox - no enum needed

interface Book {
    id: BookId;
    title: string;
    author: string | null;
    sourceFormat: SourceFormat;
    sourcePath: string;
    coverPath: string | null;        // Extracted cover thumbnail (NULL if none)
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
    segmentType: SegmentType; // 'text' | 'image'
    imageData: ImageData | null; // Only for image segments
}

type SegmentType = 'text' | 'image';

interface ImageData {
    sourcePath: string;      // Path to image file
    caption: string | null;  // AI-generated caption for narration
    altText: string | null;  // Original alt text from source
    pageNumber: number | null; // Page number if available
    position: ImagePosition; // Position on page
}

type ImagePosition = 'top' | 'middle' | 'bottom' | 'full-page' | 'inline';

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
    samplePath: string;  // Voice sample for cloning (required - Chatterbox needs it)
    isDefault: boolean;
    isCustom: boolean;   // false = shipped with app, true = user-created
}

// TTS generation parameters
interface TtsParameters {
    exaggeration: number;  // 0-10, controls expressiveness
    cfgWeight: number;     // 0-3, controls generation quality
    temperature: number;   // 0-5, controls variation
}

// Preset = saved parameter combination
type PresetId = string;    // "preset_" + UUID v4

interface Preset {
    id: PresetId;
    name: string;
    params: TtsParameters;
    isGlobal: boolean;     // true = applies to any voice
    voiceId: VoiceId | null;  // if not global, which voice this belongs to
    isDefault: boolean;    // true = shipped with app, false = user-created
}

// Built-in presets
const DEFAULT_PRESETS: Record<string, TtsParameters> = {
    robot:      { exaggeration: 0.05, cfgWeight: 0.7, temperature: 0.5 },
    calm:       { exaggeration: 0.25, cfgWeight: 0.5, temperature: 0.7 },
    default:    { exaggeration: 0.5,  cfgWeight: 0.5, temperature: 0.8 },
    expressive: { exaggeration: 0.8,  cfgWeight: 0.4, temperature: 0.9 },
    dramatic:   { exaggeration: 1.2,  cfgWeight: 0.3, temperature: 1.0 },
    unhinged:   { exaggeration: 2.0,  cfgWeight: 0.2, temperature: 1.3 },
};

interface Library {
    books: Book[];
}

// Library view and sorting preferences
type SortMode = 'date_added' | 'manual' | 'alphabetical' | 'last_opened';
type SortOrder = 'asc' | 'desc';
type ListStyle = 'detail' | 'compact';  // detail = with cover, compact = icon only

interface LibraryPreferences {
    viewMode: 'grid' | 'list';
    listStyle: ListStyle;         // For list view: show cover or icon
    sortMode: SortMode;
    sortOrder: SortOrder;
    gridOrder: BookId[];          // Manual order for grid view
    listOrder: BookId[];          // Manual order for list view
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

// Import preferences (persisted)
interface ImportPreferences {
    autoProcess: boolean;       // true = process on import, false = just import
    showImportModal: boolean;   // false after "Don't show again" checked
}

// Generation progress events
interface GenerationProgress {
    bookId: BookId;
    stage: GenerationStage;
    current: number;            // Current segment/image
    total: number;              // Total segments/images
    message: string;            // Human-readable status
}

type GenerationStage = 'extracting' | 'captioning' | 'narrating' | 'finalizing';
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
    Txt,
    Pdf,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NarrationStatus {
    None,
    Generating,
    Ready,
}

// TTS engine is always Chatterbox - no Engine enum needed

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: BookId,
    pub title: String,
    pub author: Option<String>,
    pub source_format: SourceFormat,
    pub source_path: String,
    pub cover_path: Option<String>,   // Extracted cover thumbnail
    pub narration_status: NarrationStatus,
    pub narration_path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_opened_at: Option<i64>,  // None if never opened
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SegmentType {
    Text,
    Image,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ImagePosition {
    Top,
    Middle,
    Bottom,
    FullPage,
    Inline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageData {
    pub source_path: String,
    pub caption: Option<String>,
    pub alt_text: Option<String>,
    pub page_number: Option<u32>,
    pub position: ImagePosition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: SegmentId,
    pub book_id: BookId,
    pub index: u32,
    pub content: String,
    pub html: Option<String>,
    pub segment_type: SegmentType,
    pub image_data: Option<ImageData>,
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
    pub sample_path: String,  // Required - Chatterbox needs voice sample
    pub is_default: bool,
    pub is_custom: bool,      // false = shipped with app, true = user-created
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsParameters {
    pub exaggeration: f64,   // 0-10
    pub cfg_weight: f64,     // 0-3
    pub temperature: f64,    // 0-5
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct PresetId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: PresetId,
    pub name: String,
    pub params: TtsParameters,
    pub is_global: bool,
    pub voice_id: Option<VoiceId>,
    pub is_default: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortMode {
    DateAdded,
    Manual,
    Alphabetical,
    LastOpened,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ListStyle {
    Detail,
    Compact,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPreferences {
    pub view_mode: String,       // "grid" | "list"
    pub list_style: ListStyle,
    pub sort_mode: SortMode,
    pub sort_order: String,      // "asc" | "desc"
    pub grid_order: Vec<BookId>,
    pub list_order: Vec<BookId>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GenerationStage {
    Extracting,
    Captioning,
    Narrating,
    Finalizing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationProgress {
    pub book_id: BookId,
    pub stage: GenerationStage,
    pub current: u32,
    pub total: u32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreferences {
    pub auto_process: bool,
    pub show_import_modal: bool,
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
        "name": "Rocket Scientist"
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
- `sourceFormat`: One of "epub", "markdown", "txt", "pdf"
- `createdAt`: Unix timestamp (seconds)
- `voice.name`: Display name of voice
- `voice.name`: Display name of voice (engine is always Chatterbox)
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
    "voice_sample": "/path/to/voice.wav",
    "options": {
        "exaggeration": 0.5,
        "cfg_weight": 0.5,
        "temperature": 0.8
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
| `library_view_mode` | `"grid" \| "list"` | `"grid"` | Library display mode |
| `library_list_style` | `"detail" \| "compact"` | `"detail"` | List view style (with covers or icons) |
| `library_sort_mode` | `SortMode` | `"date_added"` | How to sort books |
| `library_sort_order` | `"asc" \| "desc"` | `"desc"` | Sort direction |
| `library_grid_order` | `string` | `"[]"` | JSON array of book IDs for manual grid order |
| `library_list_order` | `string` | `"[]"` | JSON array of book IDs for manual list order |
| `tts_exaggeration` | `number` | `0.5` | Default TTS exaggeration |
| `tts_cfg_weight` | `number` | `0.5` | Default TTS CFG weight |
| `tts_temperature` | `number` | `0.8` | Default TTS temperature |
| `tts_last_preset` | `PresetId \| null` | `null` | Last used preset |

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
