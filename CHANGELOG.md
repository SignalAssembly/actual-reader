# Changelog

All notable changes to Actual Reader will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Library sorting (date added, alphabetical, manual, last opened)
- Manual book ordering (separate for grid/list views)
- List view styles (detail with covers, compact with icons)
- Book cover extraction from EPUB
- Quick text generation in Generator view
- Audio generation pipeline fixes (WAV format consistency)

---

## [0.1.0] - 2026-01-16

### Added
- **Solid.js Frontend**: Migrated from React to Solid.js for better performance
- **Library View**: Grid and list views with book cards showing status indicators
- **Reader View**: Text display with segment-based navigation
- **Generator View**: TTS controls with voice selector and parameter sliders
- **Import Modal**: "Process Now" vs "Just Import" choice with "Don't show again" option
- **Voice Management**: Create, delete, and set default voices
- **Voice Cloning**: Upload video/audio to create custom voice clones
- **TTS Parameter Controls**:
  - Exaggeration slider (0-10) for voice expressiveness
  - CFG weight slider (0-3) for generation quality
  - Temperature slider (0-5) for voice variation
- **Preset System**: 6 built-in presets (Robot, Calm, Default, Expressive, Dramatic, Unhinged)
- **Settings View**: Theme, font size, playback speed preferences
- **Book Status Indicators**: text-only, processing, ready
- **Tauri Backend**: Rust backend with SQLite storage
- **EPUB/Markdown/TXT Parsing**: Import and parse common ebook formats

### Technical
- Tauri 2.0 for cross-platform desktop app
- Solid.js + TypeScript frontend
- Rust backend with async Tauri commands
- SQLite database for library, settings, voices, presets
- Chatterbox TTS integration via subprocess
- WAV audio format (no MP3 transcoding)

### Documentation
- PRD.md: Product requirements with user stories
- ARCHITECTURE.md: System design and data flows
- SCHEMAS.md: Type definitions for frontend and backend
- STACK.md: Technology choices and versions
- ADR.md: Architecture decision records
- GLOSSARY.md: Canonical terminology

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2026-01-16 | Initial release with Solid.js frontend, TTS controls, voice management |
