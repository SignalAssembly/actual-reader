# Actual Reader

A cross-platform ebook reader with synchronized audio narration. Finally.

## Why?

It's 2026 and there's still no good way to:
- Generate TTS audio for any book you own
- Sync that audio with highlighted text (karaoke-style)
- Have it work the same on desktop, mobile, and web

EPUB3 Media Overlays exist. Reader support doesn't. So here we are.

## How It Works

**Generate on desktop. Read anywhere.**

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
│              No generation - just plays synced audio            │
└─────────────────────────────────────────────────────────────────┘
```

**Desktop** = Full experience: import books, generate audio, read with sync
**Mobile/Web** = Reader only: plays pre-generated audio synced to text

## Features (Planned)

- **Multi-format support**: EPUB, PDF, Markdown, Org-mode
- **TTS generation**: Generate audiobook from any text using modern TTS
- **Synced playback**: Text highlights as audio plays
- **Cross-platform**: Windows, Mac, Linux, iOS, Android, Web
- **Self-hostable**: Own your books, own your audio
- **Offline-first**: No internet required after setup

## Tech Stack

- **Runtime**: [Tauri 2.0](https://tauri.app/) + Rust (desktop & mobile)
- **Frontend**: React + TypeScript
- **TTS Engine**: [Chatterbox](https://github.com/resemble-ai/chatterbox) (local, free, voice cloning)
- **Audio Sync**: Custom JSON timestamp format

## Status

Early development. See [PRD.md](PRD.md) for product requirements.

## License

TBD

## Contributing

Not yet accepting contributions. Watch this space.
