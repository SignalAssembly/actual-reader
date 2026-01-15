# Actual Reader - Product Requirements Document

**Version**: 0.1 (Draft)
**Last Updated**: 2026-01-15

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
1. Opens any ebook/document (EPUB, PDF, Markdown, Org)
2. Generates high-quality TTS audio with timestamp mapping
3. Plays audio with synchronized text highlighting
4. Works identically on desktop, mobile, and web

---

## User Stories

### Core Reading Experience
- [ ] As a user, I can open an EPUB file and read it
- [ ] As a user, I can open a PDF file and read it
- [ ] As a user, I can open a Markdown file and read it
- [ ] As a user, I can adjust font size, theme, and reading preferences

### Audio Generation
- [ ] As a user, I can generate TTS audio for any book with one click
- [ ] As a user, I can choose from multiple TTS voices
- [ ] As a user, I can use my own voice clone for narration
- [ ] As a user, I can see progress while audio is generating

### Synced Playback
- [ ] As a user, I can play audio and see text highlighted in sync
- [ ] As a user, I can click any paragraph to jump audio to that position
- [ ] As a user, I can adjust playback speed (0.5x - 2x)
- [ ] As a user, I can pause/resume with spacebar
- [ ] As a user, I can skip forward/back by sentence or paragraph

### Library Management
- [ ] As a user, I can see all my books in a library view
- [ ] As a user, I can see which books have generated audio
- [ ] As a user, I can sync my library across devices
- [ ] As a user, I can import books from filesystem or URL

### Cross-Platform
- [ ] As a user, I can use the app on Windows, Mac, and Linux
- [ ] As a user, I can use the app on iOS and Android
- [ ] As a user, I can use the app in a web browser
- [ ] As a user, my reading position syncs across devices

---

## Technical Architecture

### Stack (Proposed)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Desktop Runtime | Tauri 2.0 | Small binary, Rust backend, native webview |
| Mobile Runtime | Tauri Mobile | Same codebase as desktop |
| Web Runtime | Static deploy | Same frontend, no backend needed |
| Frontend | ? | TBD - discuss options |
| TTS Engine | Pluggable | Local (Piper, Chatterbox) or Cloud (ElevenLabs) |
| Format Parsing | Rust crates | epub, pdf, markdown parsers |
| Audio Sync | Custom | JSON timestamp format, inspired by SMIL |

### Frontend Options to Discuss

1. **Vanilla JS/HTML/CSS** - Simple, no build step, maximum control
2. **Svelte** - Minimal overhead, compiles away
3. **SolidJS** - React-like but actually fast
4. **Leptos** - Rust-native, WASM, but more complex

### TTS Integration Options

1. **Local-first (Recommended)**
   - Piper (fast, offline, good quality)
   - Chatterbox (voice cloning, GPU required)
   - Coqui TTS (flexible, many models)

2. **Cloud fallback**
   - ElevenLabs (best quality, paid)
   - OpenAI TTS (good quality, paid)
   - Google Cloud TTS (okay quality, paid)

### Data Model

```
Book {
  id: uuid
  title: string
  format: epub | pdf | markdown | org
  source_path: string
  audio_status: none | generating | ready
  audio_path: string?
  sync_data: SyncData?
  reading_position: Position
  created_at: timestamp
  updated_at: timestamp
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
```

---

## Open Questions

1. **Sync granularity**: Paragraph-level or sentence-level highlighting?
2. **PDF handling**: Extract text or render as images with overlay?
3. **Voice management**: How to handle multiple voices per book (e.g., different characters)?
4. **Offline sync**: How to sync library/position without a server?
5. **Audio storage**: Store in app data or alongside book files?
6. **DRM**: Support DRM-protected EPUBs? (Probably no)

---

## MVP Scope

For v0.1, focus on:
1. Desktop only (Tauri)
2. EPUB and Markdown support
3. Single TTS engine (Piper)
4. Paragraph-level sync
5. Local storage only (no sync)

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
