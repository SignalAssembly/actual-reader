#!/usr/bin/env python3
"""
Vision Bridge for Actual Reader.

Keeps Qwen2.5-VL-7B model loaded in memory. Communicates via stdin/stdout JSON lines.

Protocol:
  Request:  {"type": "caption", "id": "req_001", "image_path": "/path/to/image.png", "context": {"page_number": 87, "position": "middle", "image_index": 2}}
  Response: {"type": "caption", "id": "req_001", "caption": "A diagram showing..."}
  Error:    {"type": "error", "id": "req_001", "code": "ENGINE_ERROR", "message": "..."}
  Shutdown: {"type": "shutdown"}
"""

import sys
import json
import os

# Globals
model = None
processor = None
device = None
request_counter = 0


def log(msg):
    """Log to stderr (stdout is for protocol only)."""
    print(f"[vision-bridge] {msg}", file=sys.stderr, flush=True)


def send(obj):
    """Send JSON response to stdout."""
    print(json.dumps(obj), flush=True)


def load_model():
    """Load Qwen2.5-VL-7B model once."""
    global model, processor, device

    log("Loading Qwen2.5-VL-7B model...")

    import torch
    from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

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

    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        "Qwen/Qwen2.5-VL-7B-Instruct",
        torch_dtype=torch.float16 if device != "cpu" else torch.float32,
        device_map="auto" if device == "cuda" else None,
    )

    if device == "mps":
        model = model.to(device)

    processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct")

    log("Model loaded.")


def format_position(position, image_index, page_number):
    """Format position description for narration."""
    position_map = {
        "top": "near the top of the page",
        "middle": "in the middle of the page",
        "bottom": "near the bottom of the page",
        "full-page": "taking the full page",
        "inline": "inline with the text",
    }

    pos_desc = position_map.get(position, "on the page")

    # Build ordinal for image index
    ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"]
    if image_index < len(ordinals):
        ordinal = ordinals[image_index]
    else:
        ordinal = f"Image {image_index + 1}"

    if page_number:
        return f"{ordinal} image on page {page_number}, {pos_desc}"
    else:
        return f"{ordinal} image, {pos_desc}"


def caption(request):
    """Generate caption for an image."""
    global request_counter

    req_id = request.get("id", f"req_{request_counter}")
    image_path = request.get("image_path")
    context = request.get("context", {})

    # Extract context
    page_number = context.get("page_number")
    position = context.get("position", "middle")
    image_index = context.get("image_index", 0)

    # Validate
    if not image_path:
        return {"type": "error", "id": req_id, "code": "INVALID_REQUEST", "message": "image_path is required"}

    if not os.path.exists(image_path):
        return {"type": "error", "id": req_id, "code": "IMAGE_NOT_FOUND", "message": f"Image not found: {image_path}"}

    try:
        from PIL import Image
        from qwen_vl_utils import process_vision_info

        # Load image
        image = Image.open(image_path).convert("RGB")

        # Build prompt for detailed, narration-friendly caption
        prompt = """Describe this image in detail for someone who cannot see it.
Focus on:
1. What type of image this is (photo, diagram, chart, illustration, etc.)
2. The main subject or content
3. Key visual elements, colors, and composition
4. Any text visible in the image
5. The apparent purpose or context of the image

Be concise but thorough. Write as a single paragraph suitable for audio narration."""

        # Prepare messages for Qwen2.5-VL
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        # Process inputs
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )
        inputs = inputs.to(device)

        # Generate
        import torch
        with torch.no_grad():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=300,
                do_sample=False,
            )

        # Decode
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        description = processor.batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0].strip()

        # Build final caption with position context
        position_prefix = format_position(position, image_index, page_number)
        full_caption = f"{position_prefix}: {description}"

        request_counter += 1
        return {
            "type": "caption",
            "id": req_id,
            "caption": full_caption
        }

    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            return {"type": "error", "id": req_id, "code": "OUT_OF_MEMORY", "message": str(e)}
        return {"type": "error", "id": req_id, "code": "ENGINE_ERROR", "message": str(e)}
    except Exception as e:
        return {"type": "error", "id": req_id, "code": "ENGINE_ERROR", "message": str(e)}


def main():
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

        elif req_type == "caption":
            response = caption(request)
            send(response)

        else:
            send({"type": "error", "code": "INVALID_REQUEST", "message": f"Unknown request type: {req_type}"})

    log("Shutting down...")
    return 0


if __name__ == "__main__":
    sys.exit(main())
