#!/usr/bin/env python3
"""
TTS Bridge for Actual Reader.

Keeps Chatterbox model loaded in memory. Communicates via stdin/stdout JSON lines.

Protocol (from SCHEMAS.md):
  Request:  {"type": "generate", "id": "req_001", "text": "Hello", "voice_sample": "/path/to/voice.wav", "options": {"exaggeration": 0.3}}
  Response: {"type": "audio", "id": "req_001", "path": "/tmp/actual_tts_001.wav", "duration": 1.5}
  Progress: {"type": "progress", "percent": 45, "message": "Generating..."}
  Error:    {"type": "error", "id": "req_001", "code": "ENGINE_ERROR", "message": "..."}
  Shutdown: {"type": "shutdown"}
"""

import sys
import json
import tempfile
import os
from pathlib import Path

# Globals
model = None
sample_rate = None
temp_dir = None
request_counter = 0


def log(msg):
    """Log to stderr (stdout is for protocol only)."""
    print(f"[tts-bridge] {msg}", file=sys.stderr, flush=True)


def send(obj):
    """Send JSON response to stdout."""
    print(json.dumps(obj), flush=True)


def load_model():
    """Load Chatterbox model once."""
    global model, sample_rate

    log("Loading Chatterbox model...")

    import torch
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    torch.backends.cudnn.benchmark = True

    # Detect device
    if torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    log(f"Using device: {device}")

    from chatterbox.tts import ChatterboxTTS
    model = ChatterboxTTS.from_pretrained(device=device)
    sample_rate = model.sr

    log("Model loaded.")


def generate(request):
    """Generate audio for a request."""
    global request_counter

    req_id = request.get("id", f"req_{request_counter}")
    text = request.get("text", "")
    voice_sample = request.get("voice_sample")
    options = request.get("options", {})

    # Validate
    if not text:
        return {"type": "error", "id": req_id, "code": "INVALID_TEXT", "message": "Text is empty"}

    if len(text) > 10000:
        return {"type": "error", "id": req_id, "code": "INVALID_TEXT", "message": "Text too long (max 10000 chars)"}

    if voice_sample and not os.path.exists(voice_sample):
        return {"type": "error", "id": req_id, "code": "VOICE_NOT_FOUND", "message": f"Voice sample not found: {voice_sample}"}

    # Extract options
    exaggeration = options.get("exaggeration", 0.5)
    cfg_weight = options.get("cfg_weight", 0.5)
    temperature = options.get("temperature", 0.8)

    try:
        import torchaudio as ta
        import io

        # Generate
        if voice_sample:
            wav = model.generate(
                text,
                audio_prompt_path=voice_sample,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight,
                temperature=temperature
            )
        else:
            wav = model.generate(
                text,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight,
                temperature=temperature
            )

        # Save to temp file
        request_counter += 1
        output_path = os.path.join(temp_dir, f"tts_{request_counter:04d}.wav")
        ta.save(output_path, wav, sample_rate)

        # Calculate duration
        duration = wav.shape[1] / sample_rate

        return {
            "type": "audio",
            "id": req_id,
            "path": output_path,
            "duration": round(duration, 3)
        }

    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            return {"type": "error", "id": req_id, "code": "OUT_OF_MEMORY", "message": str(e)}
        return {"type": "error", "id": req_id, "code": "ENGINE_ERROR", "message": str(e)}
    except Exception as e:
        return {"type": "error", "id": req_id, "code": "ENGINE_ERROR", "message": str(e)}


def main():
    global temp_dir

    # Create temp directory for outputs
    temp_dir = tempfile.mkdtemp(prefix="actual_reader_tts_")
    log(f"Temp directory: {temp_dir}")

    # Load model
    try:
        load_model()
    except Exception as e:
        send({"type": "error", "id": "init", "code": "ENGINE_ERROR", "message": f"Failed to load model: {e}"})
        return 1

    # Signal ready
    send({"type": "ready"})

    # Main loop
    log("Listening for requests...")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            send({"type": "error", "code": "INVALID_REQUEST", "message": f"Invalid JSON: {e}"})
            continue

        req_type = request.get("type")

        if req_type == "shutdown":
            log("Shutdown requested.")
            break

        elif req_type == "generate":
            response = generate(request)
            send(response)

        else:
            send({"type": "error", "code": "INVALID_REQUEST", "message": f"Unknown request type: {req_type}"})

    # Cleanup
    log("Cleaning up...")
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
