# Stack

Exact versions and dependencies for Actual Reader.

---

## Runtime

| Component | Version | Notes |
|-----------|---------|-------|
| Tauri | 2.0.x | Latest 2.0 stable |
| Rust | 1.75+ | Stable channel |
| Node.js | 20 LTS | For frontend build |
| Python | 3.11 | For TTS subprocess |

---

## Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.0 | UI framework |
| react-dom | ^18.3.0 | React DOM renderer |
| typescript | ^5.4.0 | Type safety |
| @tauri-apps/api | ^2.0.0 | Tauri IPC bindings |
| vite | ^5.4.0 | Build tool |
| zustand | ^4.5.0 | State management |
| react-router-dom | ^6.22.0 | Routing |

### Why These Versions

- **React 18.3**: Stable, concurrent features, good ecosystem
- **TypeScript 5.4**: Latest stable, better inference
- **Vite 5.4**: Fast builds, good Tauri integration
- **Zustand**: Simple state management, no boilerplate (not Redux)
- **React Router 6**: Standard routing, works with Tauri

---

## Backend (Rust)

| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2.0 | App framework |
| serde | 1.0 | Serialization |
| serde_json | 1.0 | JSON handling |
| rusqlite | 0.31 | SQLite database |
| tokio | 1.36 | Async runtime |
| uuid | 1.7 | ID generation |
| zip | 0.6 | Bundle creation |
| epub | 2.1 | EPUB parsing |
| pulldown-cmark | 0.10 | Markdown parsing |
| mdns-sd | 0.10 | Service discovery |

### Why These Versions

- **rusqlite 0.31**: Stable, bundled SQLite
- **tokio 1.36**: Required for async Tauri commands
- **epub 2.1**: Parses EPUB2 and EPUB3
- **pulldown-cmark**: CommonMark compliant, fast
- **mdns-sd**: Cross-platform mDNS (for sync discovery)

---

## TTS Engine

| Component | Version | Notes |
|-----------|---------|-------|
| chatterbox-tts | latest | Voice cloning TTS |
| torch | 2.2+ | PyTorch for inference |
| torchaudio | 2.2+ | Audio processing |
| pydub | 0.25 | Audio concatenation |

### Python Environment

TTS runs in isolated virtual environment:

```
~/ActualReader/tts-engine/
├── .venv/
├── tts_bridge.py      # Our bridge script
└── requirements.txt
```

### requirements.txt

```
chatterbox-tts
torch>=2.2.0
torchaudio>=2.2.0
pydub>=0.25.0
```

---

## Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| pnpm | 8.x | Package manager (not npm) |
| cargo | 1.75+ | Rust package manager |
| tauri-cli | 2.0 | Tauri build tool |

### Why pnpm

- Faster than npm
- Stricter dependency resolution
- Disk space efficient (hardlinks)

---

## Platform Requirements

### Desktop

| Platform | Minimum OS | Notes |
|----------|------------|-------|
| Windows | Windows 10 | WebView2 required |
| macOS | 10.15 (Catalina) | Apple Silicon or Intel |
| Linux | glibc 2.31+ | Most distros from 2020+ |

### Mobile

| Platform | Minimum OS | Notes |
|----------|------------|-------|
| iOS | iOS 14+ | Requires jailbreak for sideload |
| Android | Android 8+ (API 26) | APK sideload |

### GPU (for TTS)

| GPU | Support |
|-----|---------|
| NVIDIA (CUDA) | Full support |
| AMD (ROCm) | Linux only |
| Apple Silicon (MPS) | Supported with patches |
| Intel | CPU fallback only |
| No GPU | CPU mode (slow) |

---

## Development Environment

### Required

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# Node.js (via nvm recommended)
nvm install 20
nvm use 20

# pnpm
npm install -g pnpm

# Tauri CLI
cargo install tauri-cli

# Python 3.11 (system or pyenv)
pyenv install 3.11
pyenv local 3.11
```

### Recommended

```bash
# Rust analyzer (IDE support)
rustup component add rust-analyzer

# Clippy (Rust linter)
rustup component add clippy

# cargo-watch (auto-rebuild)
cargo install cargo-watch
```

---

## File Size Targets

| Artifact | Target Size |
|----------|-------------|
| Desktop app (without TTS) | < 15 MB |
| Desktop app (with TTS models) | < 2.5 GB |
| Mobile app | < 10 MB |
| Web bundle | < 500 KB |

### Notes

- TTS models are downloaded separately on first run
- Mobile app is smaller (no TTS code)
- Web bundle is just frontend JS/CSS

---

## Versioning Policy

- **App version**: Semantic versioning (1.0.0)
- **Bundle format version**: Separate version in manifest
- **Database schema**: Migrations with version tracking
- **API versions**: Not applicable (local app, no server)

---

## Dependency Update Policy

1. **Security patches**: Apply immediately
2. **Minor updates**: Monthly review
3. **Major updates**: Evaluate breaking changes, update if beneficial
4. **Rust crates**: Use `cargo audit` for vulnerability scanning
5. **npm packages**: Use `pnpm audit` for vulnerability scanning
