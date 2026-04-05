"""
Eve Whisper STT Server
Accepts base64 WAV audio, returns transcript.
Uses faster-whisper (runs on CPU fine for short PTT clips).

Install:
    pip install fastapi uvicorn faster-whisper pydantic

Run:
    python whisper_server.py
"""

import base64
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Eve Whisper STT", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Load Whisper model once at startup
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")  # tiny, base, small, medium

print(f"Loading Whisper {WHISPER_MODEL_SIZE}...")
from faster_whisper import WhisperModel
model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
print("Whisper ready.")


class TranscribeRequest(BaseModel):
    audio_base64: str   # base64-encoded WAV
    language: str = "en"


@app.get("/health")
def health():
    return {"status": "ok", "model": WHISPER_MODEL_SIZE}


@app.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    """Transcribe base64 audio to text."""
    try:
        audio_bytes = base64.b64decode(req.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            language=req.language,
            beam_size=3,
            vad_filter=True,   # skip silence
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return {
            "text": text,
            "language": info.language,
            "duration": round(info.duration, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        Path(tmp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5051))
    uvicorn.run(app, host="0.0.0.0", port=port)
