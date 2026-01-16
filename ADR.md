# Architecture Decision Records

Decisions made for Actual Reader. Each decision is final unless explicitly revisited.

---

## ADR-001: Tauri for Cross-Platform Runtime

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Use Tauri 2.0 as the application runtime for desktop and mobile.

### Context
Need a cross-platform framework that supports Windows, Mac, Linux, iOS, and Android from a single codebase.

### Options Considered
1. **Electron** - Mature, but 100MB+ binaries, resource heavy
2. **Tauri** - Small binaries (~5MB), Rust backend, native webview
3. **Flutter** - Dart language, not web-native
4. **React Native** - Mobile-focused, desktop support weak

### Rationale
- Tauri produces small binaries (important for sideloading)
- Rust backend allows native TTS integration
- Web frontend means we can also deploy to browsers
- Tauri 2.0 has stable mobile support
- Active development, strong community

### Consequences
- Must learn Rust for backend code
- Limited to webview rendering (no native UI widgets)
- Mobile support newer, may have edge cases

---

## ADR-002: React + TypeScript for Frontend

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Use React with TypeScript for the frontend UI.

### Context
Need a frontend framework that works well with Tauri's webview and has strong LLM tooling support for development.

### Options Considered
1. **React + TypeScript** - Massive ecosystem, best LLM training data
2. **Svelte** - Smaller bundles, but less LLM familiarity
3. **SolidJS** - Fast, but small ecosystem
4. **Vanilla JS** - No dependencies, but more boilerplate
5. **Leptos (Rust/WASM)** - Pure Rust, but complex setup

### Rationale
- React has the most Stack Overflow answers, GitHub examples, and LLM training data
- TypeScript catches errors at compile time
- Huge ecosystem of libraries (epub parsing, PDF rendering, etc.)
- Team familiarity
- LLM agents will write better React code than alternatives

### Consequences
- Larger bundle than Svelte/Solid
- React's virtual DOM overhead (acceptable for our use case)
- Must manage React's complexity (hooks, state management)

---

## ADR-003: Chatterbox as Primary TTS Engine

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Use Chatterbox TTS as the primary engine for narration generation.

### Context
Need high-quality TTS that runs locally, supports voice cloning, and is free.

### Options Considered
1. **Chatterbox** - Voice cloning, free, local, GPU-accelerated
2. **Piper** - Fast, CPU-friendly, but no voice cloning
3. **Coqui TTS** - Flexible, but project abandoned
4. **ElevenLabs** - Best quality, but paid API
5. **OpenAI TTS** - Good quality, but paid API

### Rationale
- Free and open source (MIT license)
- Voice cloning is a killer feature
- Runs on all major GPU platforms (CUDA, ROCm, MPS)
- Local = no API costs, no internet required, privacy preserved
- Quality is very good

### Final Decision
**Chatterbox only.** No multi-engine support. Keeps the codebase simple. Users who want ElevenLabs quality can use ElevenLabs directly and import the audio.

### Consequences
- Requires GPU for reasonable speed
- Mac support requires community patches (memory leak issues)
- Model download is ~2GB
- Python dependency for TTS subprocess

---

## ADR-004: No App Store Distribution

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Distribute via sideloading only. No Apple App Store or Google Play Store.

### Context
Need to get the app to users on all platforms without ongoing costs or gatekeeping.

### Options Considered
1. **App stores** - Official, discoverable, but costly and controlled
2. **Sideload only** - Free, no gatekeeping, but harder to install
3. **Hybrid** - App stores where cheap, sideload elsewhere

### Rationale
- Apple charges $99/year - ongoing cost for a free project
- App store review processes add friction and delay
- Users who want read-along books are technical enough to sideload
- Philosophy: users own their devices
- APK sideloading on Android is trivial
- iOS users who jailbreak are already comfortable with sideloading

### Consequences
- Harder for non-technical users to install on iOS
- No automatic updates via app stores
- Must build our own update mechanism
- Less discoverability

---

## ADR-005: Local-First Sync (No Cloud)

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Sync between devices via local WiFi or manual transfer. No cloud backend.

### Context
Need to get books and progress from desktop to mobile without running servers.

### Options Considered
1. **Our cloud backend** - Seamless, but costs money to run
2. **Third-party cloud (Dropbox/iCloud)** - Free for users, but adds dependency
3. **Local WiFi sync** - Free, private, but requires same network
4. **Manual transfer only** - Simplest, but worst UX

### Rationale
- No ongoing infrastructure costs
- User data stays on user devices (privacy)
- Local WiFi sync is fast and works offline
- Manual transfer is always available as fallback
- Cloud can be added later if there's demand

### Consequences
- Can't sync when away from home network
- Must implement mDNS/Bonjour for device discovery
- Manual transfer requires user to understand file management

---

## ADR-006: Desktop Generates, Mobile Reads

**Status:** Accepted
**Date:** 2026-01-15

### Decision
TTS generation only runs on desktop. Mobile apps are read-only.

### Context
TTS generation requires significant compute (GPU, memory) that mobile devices lack.

### Options Considered
1. **Generate everywhere** - Best UX, but technically impossible on mobile
2. **Cloud generation** - Works on mobile, but costs money
3. **Desktop generates, mobile reads** - Practical split based on hardware

### Rationale
- Chatterbox requires GPU + 4GB+ VRAM
- Mobile devices don't have this capability
- Desktop (Win/Mac/Linux) all have GPU options
- Clean separation: desktop = full featured, mobile = reader
- Users understand "do heavy work on computer, consume on phone"

### Consequences
- Mobile users must have access to a desktop to generate narration
- Bundle export/import becomes critical path
- Mobile app is simpler (no TTS integration)

---

## ADR-007: Paragraph-Level Sync Granularity

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Sync narration to text at the paragraph (segment) level, not sentence or word level.

### Context
Need to decide how granular the text highlighting should be during playback.

### Options Considered
1. **Word-level** - Most precise, but complex and potentially distracting
2. **Sentence-level** - Good precision, but sentence detection is hard
3. **Paragraph-level** - Simpler, natural reading unit
4. **Page-level** - Too coarse, not useful

### Rationale
- Paragraph is a natural reading unit
- TTS engines return timing per generation chunk (usually paragraph)
- Sentence boundary detection is error-prone (abbreviations, etc.)
- Word-level requires forced alignment (complex, slow)
- Paragraph highlighting is less visually noisy
- Can refine to sentence-level later if needed

### Consequences
- Less precise sync (user might be mid-paragraph)
- Clicking text jumps to paragraph start, not exact word
- Simpler implementation

---

## ADR-008: Custom Bundle Format (.actualbook)

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Create a custom bundle format for exported books rather than using EPUB3 Media Overlays.

### Context
Need a format to package book + narration + markers for transfer between devices.

### Options Considered
1. **EPUB3 Media Overlays** - Standard, but poorly supported by readers
2. **Custom format** - Full control, but non-standard
3. **Directory structure** - Simple, but not a single file

### Rationale
- EPUB3 Media Overlays are a broken standard (reader support is terrible)
- We ARE the reader, so we control the format
- Custom format can be optimized for our needs
- Single file (.actualbook) is easier to transfer than directory
- Can always export to EPUB3 later for compatibility

### Consequences
- Non-standard format (only works with Actual Reader)
- Must document format specification
- No ecosystem of tools (we build everything)

---

## ADR-009: No DRM Support

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Do not implement DRM decryption. Users must provide DRM-free files.

### Context
Many ebooks are sold with DRM encryption that prevents reading in unauthorized apps.

### Options Considered
1. **Support DRM** - Better UX for users with DRM books, but legally risky
2. **No DRM support** - Users strip DRM themselves, legally safer
3. **Partner with DRM providers** - Legitimate, but complex and costly

### Rationale
- Circumventing DRM is legally grey (DMCA in US, similar laws elsewhere)
- DRM implementation is complex (multiple schemes: Adobe, Amazon, Apple)
- Tools exist for users to strip DRM themselves (Calibre + DeDRM)
- Philosophy: if you bought it, you own it - but that's your fight, not ours
- Keeps us out of legal trouble

### Consequences
- Users with DRM books have extra step (strip DRM first)
- Can't directly import from Kindle, Kobo, etc.
- Some users may not know how to strip DRM

---

## ADR-010: Web Version is Read-Only

**Status:** Accepted
**Date:** 2026-01-15

### Decision
The web version of Actual Reader is read-only (no generation, no library management).

### Context
Need to decide what features the web version supports.

### Options Considered
1. **Full web app** - All features, but requires backend for TTS
2. **Read-only web** - Just plays bundles, no generation
3. **No web version** - Desktop and mobile only

### Rationale
- TTS generation can't run in browser (needs Python + GPU)
- Running a cloud TTS backend costs money
- Web can still play pre-generated bundles
- Useful for sharing: "here's a link to read this book"
- Simple static hosting (no backend needed)

### Consequences
- Web users can't generate narration
- Web users can't manage library
- Must upload bundle to web to read
- Limited use case (sharing, quick access)

---

## ADR-011: Qwen2.5-VL for Image Captioning

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Use Qwen2.5-VL-7B-Instruct for generating image captions during narration.

### Context
Books contain images that need audio descriptions. When generating narration, images should be described for listeners with context (position on page, description of content).

### Options Considered
1. **InternVL3-78B** - SOTA quality (MMMU 72.2), but needs ~160GB VRAM
2. **Qwen2.5-VL-72B** - Excellent quality (MMMU 70.2), but needs ~150GB VRAM
3. **Qwen2.5-VL-7B** - Great quality (MMMU 58.6), runs on consumer GPUs (~16GB)
4. **LLaMA 3.2-11B Vision** - Good quality (MMMU 50.7), ~24GB VRAM
5. **MiniCPM-o 2.6** - Fast throughput, lower quality (~55 MMMU), ~8GB VRAM
6. **Cloud APIs (GPT-4V, Claude)** - Best quality, but costs money

### Rationale
- **Quality priority**: User is dogfooding, wants highest quality possible on consumer hardware
- **Qwen2.5-VL-7B beats larger competitors**: Outperforms LLaMA 3.2-11B Vision despite being smaller
- **Consumer GPU compatible**: Runs on RTX 3090/4090 class GPUs (16-24GB VRAM)
- **Free and local**: No API costs, no internet required, same as TTS philosophy
- **Shared environment**: Same Python/torch setup as Chatterbox TTS
- **Detailed descriptions**: Excellent at OCR and visual reasoning for precise captions

### Caption Format
```
"[Position] image on page [N], [location on page]: [detailed description]"

Example: "Second image on page 87, two-thirds down: A diagram showing the
water cycle with labeled arrows indicating evaporation, condensation, and
precipitation stages."
```

### Consequences
- Adds ~14GB to model downloads (on top of TTS models)
- Image processing adds time to narration generation
- Requires GPU with 16GB+ VRAM for quality model
- Users with less VRAM could use MiniCPM-o 2.6 as fallback (future enhancement)

---

## ADR-012: Import Without Processing

**Status:** Accepted
**Date:** 2026-01-15

### Decision
Allow users to import books without generating narration, as a pure ebook reader.

### Context
Not every user wants audio narration for every book. Some may want to:
- Read without audio (traditional ebook experience)
- Process narration later when they have time
- Test the reader before committing to long generation times

### Options Considered
1. **Always process on import** - Simpler, but forces long wait
2. **Never auto-process** - User must explicitly request, more control
3. **Ask on import** - Modal with "Process Now" or "Just Import" options

### Rationale
- First-time users shouldn't wait 30+ minutes before seeing the app work
- Power users may have specific books they want narrated vs. just read
- Background processing allows work to continue while using the app
- Modal with "Don't show again" (checked by default) reduces friction after first use

### Import Flow
```
1. User imports book
2. First-time: Modal appears
   - "Process Now" - Start narration generation
   - "Just Import" - Add to library as text-only
   - [x] Don't show this again (checked by default)
3. Subsequent imports: Uses remembered preference
4. Library shows status: 📖 text-only | ⏳ processing | 🎧 ready
5. Kebab menu on any book: "Generate narration" option
```

### Consequences
- More complex import flow
- Need to persist user preference
- Library view needs status indicators
- Background processing queue management
