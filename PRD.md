# Actual Reader - Product Requirements Document

**Version**: 0.2
**Last Updated**: 2026-01-16

---

## Problem Statement

Reading with synchronized audio narration improves comprehension, accessibility, and enjoyment. The technology exists (EPUB3 Media Overlays, SMIL), but:

1. **No reader supports it well across platforms** - Foliate is Linux-only, Apple Books only does fixed-layout, Android options are sparse
2. **No tool generates the audio** - You need to already have professional narration
3. **No unified workflow** - Text and audio are treated as separate concerns

Users who want to "read along" with audio must either:
- Buy expensive Audible + Kindle combos (WhisperSync)
- Use janky TTS that doesn't sync with text
- Give up

## Solution

**Actual Reader**: A cross-platform app that:
1. Opens any ebook/document (EPUB, Markdown, TXT, PDF)
2. Generates high-quality TTS audio with timestamp mapping
3. Plays audio with synchronized text highlighting
4. Works on desktop, mobile, and web

---

## Architecture: Generate on Desktop, Read Anywhere

```
┌─────────────────────────────────────────────────────────────────┐
│                         DESKTOP                                 │
│              (Windows, Mac, Linux)                              │
│                                                                 │
│   ┌─────────┐      ┌─────────────┐      ┌─────────────────┐    │
│   │  Book   │ ───► │  Generate   │ ───► │  Book + Audio   │    │
│   │  (any)  │      │   Audio     │      │   + Sync Data   │    │
│   └─────────┘      └─────────────┘      └────────┬────────┘    │
│                     Chatterbox TTS               │              │
│                     (local, free)                │              │
│                                                  ▼              │
│                                          ┌─────────────┐        │
│                                          │    READ     │        │
│                                          │   (here)    │        │
│                                          └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ sync
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MOBILE / WEB                               │
│              (iOS, Android, Browser)                            │
│                                                                 │
│                         ┌─────────────┐                         │
│                         │    READ     │                         │
│                         │   (only)    │                         │
│                         └─────────────┘                         │
│                                                                 │
│              No generation - plays synced audio only            │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Split?

TTS generation (especially with voice cloning) requires:
- GPU acceleration (NVIDIA CUDA, AMD ROCm, or Apple MPS)
- 4+ GB VRAM
- Python runtime with PyTorch

Mobile devices and browsers cannot run this. Desktop can.

### Platform Capabilities

| Platform | Generate Audio | Read with Sync |
|----------|---------------|----------------|
| Linux + NVIDIA | ✅ | ✅ |
| Linux + AMD | ✅ | ✅ |
| Windows + NVIDIA | ✅ | ✅ |
| Windows + AMD | ✅ | ✅ |
| Mac (Apple Silicon) | ✅ | ✅ |
| Mac (Intel) | ⚠️ CPU only, slow | ✅ |
| iOS | ❌ | ✅ |
| Android | ❌ | ✅ |
| Web Browser | ❌ | ✅ |

---

## User Stories

### Core Reading Experience
- [x] As a user, I can import and read books without audio processing
- [x] As a user, I can open an EPUB file and read it (with images preserved)
- [x] As a user, I can open a Markdown file and read it
- [x] As a user, I can open a TXT file and read it
- [ ] As a user, I can open a PDF file and read it (best-effort text extraction)
- [x] As a user, I can adjust font size, theme, and reading preferences

### Import & Processing
- [x] First-time modal explains processing (with "Don't show again" checked by default)
- [x] As a user, I can choose to "Process Now" or "Just Import" on import
- [ ] As a user, I can process a book later via kebab menu ("Process for audio")
- [ ] As a user, I can see processing progress with option to run in background
- [ ] As a user, I can check on background processing tasks

### Audio Generation
- [ ] As a user, I can generate TTS audio for any book with one click
- [x] As a user, I can choose from multiple TTS voices (Chatterbox clones)
- [x] As a user, I can use my own voice clone for narration
- [ ] As a user, I can see progress while audio is generating

### TTS Controls (Generator View)
- [x] As a user, I can select a voice for narration
- [x] As a user, I can adjust exaggeration (0-10) for voice expressiveness
- [x] As a user, I can adjust CFG weight (0-3) for generation quality
- [x] As a user, I can adjust temperature (0-5) for voice variation
- [x] As a user, I can choose from presets: Robot, Calm, Default, Expressive, Dramatic, Unhinged
- [ ] As a user, I can quick-generate audio from text input
- [x] As a user, I can manage voices (create, delete, set default)
- [x] As a user, I can create a voice clone by uploading video/audio

### Voice System
- [x] App ships with default voices ready to use
- [x] As a user, I can create custom voice clones from audio/video uploads
- [ ] As a user, I can create custom presets (saved parameter combinations)
- [ ] Global presets apply to any voice
- [ ] Local presets are saved within a specific profile
- [ ] Profiles = Voice + Preset combination

### Image Handling
- [ ] Images are preserved and displayed in reading view
- [ ] Images get auto-generated captions for audio narration
- [ ] Caption format: "Second image on page 87, two-thirds down: [description]"
- [ ] Uses local vision model (Qwen2.5-VL-7B) for caption generation

### Synced Playback
- [x] As a user, I can play audio and see text highlighted in sync
- [x] As a user, I can click any paragraph to jump audio to that position
- [ ] As a user, I can adjust playback speed (0.5x - 2x)
- [ ] As a user, I can pause/resume with spacebar
- [ ] As a user, I can skip forward/back by sentence or paragraph

### Library Management
- [x] As a user, I can see all my books in a library view
- [x] As a user, I can see book status: 📖 text-only | ⏳ processing | 🎧 ready
- [ ] As a user, I can sync my library across devices
- [x] As a user, I can import books from filesystem or URL

### Library Sorting & Views
- [ ] As a user, I can sort by date added (default, most recent first)
- [ ] As a user, I can sort by last opened
- [ ] As a user, I can sort alphabetically by title
- [ ] As a user, I can manually arrange books (drag-and-drop in grid, up/down in list)
- [ ] Manual order is saved separately for grid and list views
- [x] As a user, I can toggle between grid and list views
- [ ] List view has detail mode (with cover thumbnails) and compact mode (icon only)
- [ ] Grid cards show actual book cover extracted from EPUB
- [ ] Recently opened section appears below main library with same card style
- [ ] Sort preferences persist across sessions

### Cross-Platform
- [ ] As a user, I can use the app on Windows, Mac, and Linux
- [ ] As a user, I can use the app on iOS (sideload via jailbreak)
- [ ] As a user, I can use the app on Android (sideload APK)
- [ ] As a user, I can use the app in a web browser
- [ ] As a user, I can sync books to mobile via local WiFi
- [ ] As a user, I can manually transfer books to mobile (export/import)

---

## Technical Architecture

### Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Desktop Runtime | Tauri 2.0 | Small binary, Rust backend, native webview |
| Mobile Runtime | Tauri Mobile | Same codebase as desktop |
| Web Runtime | Static deploy | Same frontend, no backend needed |
| Frontend | Solid.js + TypeScript | Reactive, fast, smaller bundles than React |
| TTS Engine | Chatterbox (local) | Free, voice cloning, runs on all desktop GPUs |
| Vision Model | Qwen2.5-VL-7B-7B (local) | Image captioning for audio, free, high quality |
| Format Parsing | Rust crates | epub, pdf, markdown parsers |
| Audio Sync | Custom JSON | Timestamp format inspired by SMIL |

### TTS Engine: Chatterbox

**Why Chatterbox?**
- Free and open source (MIT license)
- Voice cloning capability
- Runs locally - no API costs, no internet required
- Works on NVIDIA (CUDA), AMD (ROCm), and Apple Silicon (MPS)

**Platform-specific notes:**
- Linux/Windows + NVIDIA: Native CUDA, best performance
- Linux + AMD: ROCm support
- Mac Apple Silicon: MPS support via community patches
  - [chatterbox-tts-apple-silicon-code](https://huggingface.co/Jimmi42/chatterbox-tts-apple-silicon-code)
  - Known memory leak issue, but functional
- Mac Intel: CPU-only, slow but works

**No cloud fallback.** Chatterbox only. Local generation, no API costs, no internet required.

### Sync Strategy

**No cloud.** Users sync between devices locally.

| Method | Description |
|--------|-------------|
| **Local WiFi sync** | Desktop runs local server, mobile connects on same network |
| **Manual transfer** | Export book bundle (book + audio + sync data), transfer via USB/AirDrop/email, import on mobile |

Cloud sync may be added later if there's demand, but it's not a priority. Users own their data.

### Distribution

No app stores. Sideload only.

| Platform | Distribution |
|----------|-------------|
| Windows | `.exe` / `.msi` from GitHub releases |
| Mac | `.dmg` from GitHub releases |
| Linux | `.AppImage` / `.deb` from GitHub releases |
| Android | `.apk` sideload from GitHub releases |
| iOS | Sideload via AltStore (7-day refresh), TrollStore (iOS ≤17.0), or jailbreak |
| Web | Self-host or use hosted instance |

**Why no app stores?**
- Apple charges $99/year for the privilege
- Google charges $25 one-time
- Review processes add friction
- We want users to own their devices

### Data Model

```
Book {
  id: uuid
  title: string
  format: epub | markdown | txt | pdf
  source_path: string
  cover_path: string?            // Extracted cover thumbnail
  audio_status: none | generating | ready
  audio_path: string?
  sync_data: SyncData?
  reading_position: Position
  created_at: timestamp
  updated_at: timestamp
  last_opened_at: timestamp?     // For "Recently Opened" and sorting
}

SyncData {
  book_id: uuid
  total_duration: float
  segments: [Segment]
}

Segment {
  id: string           // paragraph/element ID
  text: string         // the text content
  start: float         // audio start time (seconds)
  end: float           // audio end time (seconds)
}

Position {
  element_id: string
  audio_time: float?
  scroll_offset: float
}

Voice {
  id: string
  name: string
  sample_path: string    // Voice sample for cloning
  is_default: boolean
  is_custom: boolean     // false = shipped with app, true = user-created
}

TtsParameters {
  exaggeration: float    // 0-10, controls expressiveness
  cfg_weight: float      // 0-3, controls generation quality
  temperature: float     // 0-5, controls variation
}

Preset {
  id: string
  name: string
  params: TtsParameters
  is_global: boolean     // true = applies to any voice
  voice_id: string?      // if not global, which voice this belongs to
  is_default: boolean    // shipped with app vs user-created
}

LibraryPreferences {
  view_mode: 'grid' | 'list'
  list_style: 'detail' | 'compact'
  sort_mode: 'date_added' | 'manual' | 'alphabetical' | 'last_opened'
  sort_order: 'asc' | 'desc'
  grid_order: [book_id]   // Manual order for grid view
  list_order: [book_id]   // Manual order for list view
}
```

---

## Open Questions

1. **Sync granularity**: Paragraph-level or sentence-level highlighting?
2. **PDF handling**: Extract text or render as images with overlay?
3. **Voice management**: How to handle multiple voices per book (e.g., different characters)?
4. **Audio storage**: Store in app data or alongside book files?
5. ~~**DRM**: Support DRM-protected EPUBs?~~ **No.** Users strip DRM themselves before importing (Calibre + DeDRM). We read clean files only.
6. **Book bundle format**: What format for exported book+audio+sync packages?

---

## MVP Scope

For v0.1, focus on:
1. Desktop app (Windows, Mac, Linux via Tauri)
2. EPUB, Markdown, and TXT support (PDF deferred - complex, low ROI)
3. Chatterbox TTS (local generation)
4. Paragraph-level sync highlighting
5. Manual export/import for mobile transfer
6. Solid.js + TypeScript frontend

For v0.2:
1. Mobile apps (Android APK, iOS via jailbreak)
2. Local WiFi sync between desktop and mobile
3. Reading position sync

---

## Success Metrics

- [ ] Can open and read an EPUB with generated audio in < 5 minutes
- [ ] Audio sync is accurate within 0.5 seconds
- [ ] App binary < 20MB (excluding TTS models)
- [ ] Works offline after initial setup

---

## Timeline

TBD - This is a side project, no hard deadlines.

---

## Notes

This document is a living draft. Discuss and refine before implementation.
