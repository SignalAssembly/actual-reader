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
**Mobile/Web** = Reader only: plays pre-generated audio

### Getting Books to Mobile

| Method | How |
|--------|-----|
| **Local WiFi** | Desktop and mobile on same network, sync automatically (or enter IP manually) |
| **Manual transfer** | Export `.actualbook` bundle, transfer via USB/AirDrop/email |

No cloud. You own your data.

### Installation

No app stores. Sideload only.

| Platform | Method |
|----------|--------|
| **Windows** | `.exe` from [Releases](https://github.com/SignalAssembly/actual-reader/releases) |
| **macOS** | `.dmg` from [Releases](https://github.com/SignalAssembly/actual-reader/releases) |
| **Linux** | `.AppImage` from [Releases](https://github.com/SignalAssembly/actual-reader/releases) |
| **Android** | `.apk` sideload from [Releases](https://github.com/SignalAssembly/actual-reader/releases) |
| **iOS** | [AltStore](https://altstore.io/) (7-day refresh), [TrollStore](https://github.com/opa334/TrollStore) (iOS ≤17.0), or jailbreak |

### Requirements (for audio generation)

- **GPU**: NVIDIA (CUDA), AMD (ROCm on Linux), or Apple Silicon (MPS)
- **VRAM**: 4GB+ recommended
- **Disk**: ~2GB for TTS models (downloaded on first use)

No GPU? Generation will be slow but works on CPU.

## Features

- **Multi-format**: EPUB, Markdown, TXT (PDF later)
- **TTS generation**: High-quality audio with voice cloning (Chatterbox)
- **Synced playback**: Text highlights as audio plays
- **Cross-platform**: Windows, Mac, Linux, iOS, Android, Web
- **Offline-first**: No internet required after setup
- **No DRM**: Import clean files only (strip DRM yourself via Calibre)

## Tech Stack

- **Runtime**: [Tauri 2.0](https://tauri.app/) (desktop & mobile)
- **Frontend**: React + TypeScript
- **TTS Engine**: [Chatterbox](https://github.com/resemble-ai/chatterbox) (local, free, voice cloning)
- **Audio Sync**: Custom JSON timestamp format

## Development

```bash
# Prerequisites
rustup default stable
pnpm install

# Run in development
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Documentation

- [PRD.md](PRD.md) - Product requirements
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [SCHEMAS.md](SCHEMAS.md) - Data structures
- [STACK.md](STACK.md) - Dependencies and versions
- [ADR.md](ADR.md) - Architecture decisions
- [GLOSSARY.md](GLOSSARY.md) - Terminology

## Status

Early development. See [PRD.md](PRD.md) for full requirements.

## Support

If this is useful to you:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/brianwijaya)

## License

MIT
