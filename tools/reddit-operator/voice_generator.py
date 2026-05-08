"""
ElevenLabs TTS — converts text scripts to MP3 audio files.

Usage (standalone):
    python voice_generator.py "Your script text here" output_filename

Usage (as module):
    from voice_generator import generate_voice
    path = generate_voice("Your script", "post_001")
"""

import os
import sys
import re
from pathlib import Path

import requests

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel
OUTPUT_DIR = Path(__file__).parent / "output" / "audio"

# eleven_turbo_v2_5 — fastest + lowest cost; good for social content
MODEL_ID = "eleven_turbo_v2_5"


def generate_voice(text: str, filename: str) -> str | None:
    """
    Convert text to MP3 via ElevenLabs TTS.
    Returns the output file path on success, None on failure or missing key.

    Args:
        text: The narration script (plain text, no SSML needed).
        filename: Output filename without extension (e.g. "post_2026_05_07_001").
    """
    if not ELEVENLABS_API_KEY:
        print("[voice] ELEVENLABS_API_KEY not set — skipping", flush=True)
        return None

    # Sanitize filename
    safe_name = re.sub(r"[^\w\-]", "_", filename)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{safe_name}.mp3"

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }

    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        r.raise_for_status()
        out_path.write_bytes(r.content)
        size_kb = len(r.content) // 1024
        print(f"[voice] Saved {out_path} ({size_kb}KB)", flush=True)
        return str(out_path)
    except requests.HTTPError as e:
        print(f"[voice] ElevenLabs HTTP error {e.response.status_code}: {e.response.text[:200]}", flush=True)
        return None
    except Exception as e:
        print(f"[voice] ElevenLabs error: {e}", flush=True)
        return None


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python voice_generator.py <text> <filename>")
        sys.exit(1)
    result = generate_voice(sys.argv[1], sys.argv[2])
    if result:
        print(f"Output: {result}")
        sys.exit(0)
    else:
        sys.exit(1)
