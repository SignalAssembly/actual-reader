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
| Frontend | React + TypeScript | Best LLM support, massive ecosystem |
| TTS Engine | Chatterbox (local) | Free, voice cloning, runs on all desktop GPUs |
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

**Optional cloud fallback:**
- ElevenLabs API for users who prefer cloud
- Useful for Mac Intel users who want faster generation

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
| iOS | Sideload via jailbreak (`.ipa`) |
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
4. **Audio storage**: Store in app data or alongside book files?
5. **DRM**: Support DRM-protected EPUBs? (Probably no)
6. **Book bundle format**: What format for exported book+audio+sync packages?

---

## MVP Scope

For v0.1, focus on:
1. Desktop app (Windows, Mac, Linux via Tauri)
2. EPUB and Markdown support
3. Chatterbox TTS (local generation)
4. Paragraph-level sync highlighting
5. Manual export/import for mobile transfer
6. React + TypeScript frontend

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
