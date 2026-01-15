# Glossary

Canonical terminology for Actual Reader. Use these terms exactly. No synonyms.

---

## Core Concepts

### Book
A single piece of content imported by the user. Not "document", "file", "ebook", or "title".

```
✓ "Import a book"
✓ "The book's audio"
✗ "Import a document"
✗ "The file's audio"
```

### Library
The collection of all books. Not "catalog", "collection", or "bookshelf".

```
✓ "Add to library"
✓ "Library view"
✗ "Add to collection"
✗ "Bookshelf view"
```

### Narration
The generated audio for a book. Not "audio", "speech", "voice", or "TTS output".

```
✓ "Generate narration"
✓ "Play narration"
✗ "Generate audio"
✗ "Play speech"
```

### Voice
A TTS voice profile used to generate narration. Not "speaker", "narrator", or "model".

```
✓ "Select a voice"
✓ "Clone your voice"
✗ "Select a speaker"
✗ "Clone your narrator"
```

### Segment
A single unit of text with corresponding narration timing. Not "chunk", "paragraph", "sentence", or "block".

```
✓ "50 segments"
✓ "Segment timing"
✗ "50 chunks"
✗ "Paragraph timing"
```

### Marker
A timestamp pointing to a position in narration. Not "timestamp", "cue", or "sync point".

```
✓ "Marker at 3.5s"
✓ "Jump to marker"
✗ "Timestamp at 3.5s"
✗ "Sync point"
```

---

## Data & Files

### Bundle
The exported package containing book + narration + markers. Not "package", "archive", or "export".

```
✓ "Export bundle"
✓ "Import bundle"
✗ "Export package"
✗ "Import archive"
```

File extension: `.actualbook`

### Source
The original imported file (EPUB, PDF, Markdown). Not "original", "input", or "raw".

```
✓ "Source file"
✓ "Source format"
✗ "Original file"
✗ "Input format"
```

### Manifest
The JSON metadata file within a bundle. Not "metadata", "index", or "config".

```
✓ "Bundle manifest"
✗ "Bundle metadata"
```

---

## UI & Navigation

### Reader
The reading view where text and narration play. Not "viewer", "player", or "view".

```
✓ "Open in reader"
✓ "Reader settings"
✗ "Open in viewer"
✗ "Player settings"
```

### Progress
How far through a book the user has read/listened. Not "position", "location", or "place".

```
✓ "Save progress"
✓ "Resume progress"
✗ "Save position"
✗ "Resume location"
```

### Highlight
The visual indicator showing the current segment during playback. Not "highlight", "selection", "focus", or "cursor".

Wait - this IS "highlight". Confirming: use "highlight".

```
✓ "Highlight follows narration"
✗ "Selection follows narration"
✗ "Focus follows narration"
```

---

## Actions

### Generate
Creating narration from text. Not "synthesize", "create", "produce", or "render".

```
✓ "Generate narration"
✗ "Synthesize audio"
✗ "Create speech"
```

### Import
Adding a source file to the library. Not "add", "open", or "load".

```
✓ "Import book"
✗ "Add book"
✗ "Open book"
```

### Export
Creating a bundle from a book. Not "save", "package", or "archive".

```
✓ "Export bundle"
✗ "Save bundle"
✗ "Package book"
```

### Sync
Transferring books/progress between devices. Not "transfer", "share", or "send".

```
✓ "Sync to mobile"
✓ "Sync progress"
✗ "Transfer to mobile"
✗ "Share book"
```

---

## Technical

### Engine
The TTS system (Chatterbox, Piper, etc.). Not "model", "backend", or "synthesizer".

```
✓ "TTS engine"
✓ "Switch engine"
✗ "TTS model"
✗ "TTS backend"
```

### Desktop
Windows, Mac, or Linux. Not "PC", "computer", or "client".

```
✓ "Desktop app"
✗ "PC app"
✗ "Client app"
```

### Mobile
iOS or Android. Not "phone", "device", or "handheld".

```
✓ "Mobile app"
✗ "Phone app"
```

---

## Banned Terms

Never use these terms in code, UI, or documentation:

| Banned | Use Instead |
|--------|-------------|
| document | book |
| file (for books) | book or source |
| audio | narration |
| timestamp | marker |
| chunk/paragraph | segment |
| package/archive | bundle |
| position/location | progress |
| synthesize | generate |
| add (for import) | import |
| model (for TTS) | engine or voice |
| client | desktop or mobile |

---

## Variable Naming

In code, use these exact names:

```typescript
// Correct
book: Book
library: Library
narration: Narration
voice: Voice
segment: Segment
marker: Marker
bundle: Bundle
progress: Progress

// Incorrect
doc: Document
audioFile: AudioFile
chunk: Chunk
timestamp: Timestamp
position: Position
```
