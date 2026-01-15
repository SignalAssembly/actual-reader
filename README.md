# Actual Reader

A cross-platform ebook reader with synchronized audio narration. Finally.

## Why?

It's 2026 and there's still no good way to:
- Generate TTS audio for any book you own
- Sync that audio with highlighted text (karaoke-style)
- Have it work the same on desktop, mobile, and web

EPUB3 Media Overlays exist. Reader support doesn't. So here we are.

## Features (Planned)

- **Multi-format support**: EPUB, PDF, Markdown, Org-mode
- **TTS generation**: Generate audiobook from any text using modern TTS
- **Synced playback**: Text highlights as audio plays
- **Cross-platform**: Windows, Mac, Linux, iOS, Android, Web
- **Self-hostable**: Own your books, own your audio
- **Offline-first**: No internet required after setup

## Tech Stack

- **Desktop/Mobile**: [Tauri](https://tauri.app/) + Rust
- **Frontend**: TBD
- **TTS Engine**: TBD (likely pluggable - local or cloud)
- **Audio Sync**: Custom SMIL-like system

## Status

Early development. See [PRD.md](PRD.md) for product requirements.

## License

TBD

## Contributing

Not yet accepting contributions. Watch this space.
