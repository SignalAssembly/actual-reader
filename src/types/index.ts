/**
 * Core TypeScript types for Actual Reader
 *
 * These types match the schemas defined in SCHEMAS.md exactly.
 * Use GLOSSARY.md terminology: "narration" not "audio", "segment" not "paragraph"
 */

// =============================================================================
// Type Aliases
// =============================================================================

/** UUID v4 identifier for a book */
export type BookId = string;

/** Segment identifier: "seg_" + UUID v4 */
export type SegmentId = string;

/** Voice identifier: "voice_" + UUID v4 */
export type VoiceId = string;

/** Unix timestamp in seconds */
export type Timestamp = number;

/** Duration in seconds (float) */
export type Duration = number;

// =============================================================================
// Union Types
// =============================================================================

/** Supported source file formats for import */
export type SourceFormat = 'epub' | 'markdown' | 'txt' | 'pdf';

/** Status of narration generation for a book */
export type NarrationStatus = 'none' | 'generating' | 'ready';

// TTS engine is always Chatterbox - no enum needed

// =============================================================================
// Core Interfaces
// =============================================================================

/**
 * A single piece of content imported by the user.
 * Use "book" not "document", "file", or "ebook"
 */
export interface Book {
  id: BookId;
  title: string;
  author: string | null;
  sourceFormat: SourceFormat;
  sourcePath: string;
  narrationStatus: NarrationStatus;
  narrationPath: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** NULL if never opened, used for "Recent" section */
  lastOpenedAt: Timestamp | null;
}

/**
 * A single unit of text with corresponding narration timing.
 * Use "segment" not "chunk", "paragraph", or "block"
 */
export interface Segment {
  id: SegmentId;
  bookId: BookId;
  /** 0-based position */
  index: number;
  /** Plain text content */
  content: string;
  /** Optional HTML rendering */
  html: string | null;
}

/**
 * A timestamp pointing to a position in narration.
 * Use "marker" not "timestamp", "cue", or "sync point"
 */
export interface Marker {
  segmentId: SegmentId;
  /** Start time in narration (seconds) */
  start: Duration;
  /** End time in narration (seconds) */
  end: Duration;
}

/**
 * How far through a book the user has read/listened.
 * Use "progress" not "position" or "location"
 */
export interface Progress {
  bookId: BookId;
  /** Current segment index */
  segmentIndex: number;
  /** Position in narration (seconds), null if not using narration */
  audioTime: Duration | null;
  updatedAt: Timestamp;
}

/**
 * A TTS voice profile used to generate narration (Chatterbox voice cloning).
 * Use "voice" not "speaker", "narrator", or "model"
 */
export interface Voice {
  id: VoiceId;
  name: string;
  /** Path to voice sample for cloning */
  samplePath: string;
  isDefault: boolean;
}

// =============================================================================
// Collection Interfaces
// =============================================================================

/**
 * The collection of all books.
 * Use "library" not "catalog", "collection", or "bookshelf"
 */
export interface Library {
  books: Book[];
}

// =============================================================================
// Sync Interfaces
// =============================================================================

/**
 * A discovered sync server on the local network
 */
export interface SyncServer {
  /** Device name */
  name: string;
  /** IP address */
  address: string;
  port: number;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  booksAdded: number;
  progressSynced: number;
  errors: string[];
}

// =============================================================================
// Settings Types
// =============================================================================

/** UI theme setting */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Application settings stored as key-value pairs
 */
export interface Settings {
  /** UI theme */
  theme: Theme;
  /** Reader font size in pixels */
  fontSize: number;
  /** Reader font family */
  fontFamily: string;
  /** Line height multiplier */
  lineHeight: number;
  /** Narration playback speed (0.5-2.0) */
  playbackSpeed: number;
  /** Segment highlight color (hex) */
  highlightColor: string;
  /** Default voice for generation */
  defaultVoice: VoiceId | null;
  /** Auto-play narration on book open */
  autoPlay: boolean;
  /** Local sync server port */
  syncPort: number;
}

/** Default settings values */
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 16,
  fontFamily: 'system',
  lineHeight: 1.6,
  playbackSpeed: 1.0,
  highlightColor: '#ffeb3b',
  defaultVoice: null,
  autoPlay: false,
  syncPort: 42069,
};

// =============================================================================
// Event Payload Types (for Tauri events)
// =============================================================================

/** Payload for generation_progress event */
export interface GenerationProgressPayload {
  bookId: BookId;
  percent: number;
}

/** Payload for generation_complete event */
export interface GenerationCompletePayload {
  bookId: BookId;
}

/** Payload for generation_error event */
export interface GenerationErrorPayload {
  bookId: BookId;
  error: string;
}

/** Payload for sync_discovered event */
export interface SyncDiscoveredPayload {
  server: SyncServer;
}

/** Payload for sync_progress event */
export interface SyncProgressPayload {
  percent: number;
}
