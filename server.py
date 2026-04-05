"""
Eve Piper TTS Server
FastAPI wrapper around Piper — returns WAV audio for any text input.

Install:
    pip install fastapi uvicorn pydantic
    # Download Piper binary + voice model:
    # https://github.com/rhasspy/piper/releases
    # https://huggingface.co/rhasspy/piper-voices

Run:
    python server.py

Deploy on Railway:
    Add this as a separate Railway service in Eve's repo.
    Set PORT env var (Railway injects it automatically).
"""

import io
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="Eve Piper TTS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Config ───────────────────────────────────────────────────────────────────
PIPER_BIN = os.getenv("PIPER_BIN", "./piper/piper")          # path to piper binary
MODELS_DIR = os.getenv("PIPER_MODELS_DIR", "./piper/models") # dir holding .onnx + .json files

AVAILABLE_VOICES = {
    name.stem.replace(".onnx", "")
    for name in Path(MODELS_DIR).glob("*.onnx")
} if Path(MODELS_DIR).exists() else {"en_US-lessac-medium"}

DEFAULT_VOICE = os.getenv("PIPER_DEFAULT_VOICE", "en_US-lessac-medium")


def get_model_path(voice: str) -> str:
    model = Path(MODELS_DIR) / f"{voice}.onnx"
    if not model.exists():
        raise HTTPException(status_code=404, detail=f"Voice model '{voice}' not found in {MODELS_DIR}")
    return str(model)


@app.get("/health")
def health():
    return {"status": "ok", "voices": list(AVAILABLE_VOICES)}


@app.get("/voices")
def list_voices():
    return {"voices": sorted(AVAILABLE_VOICES)}


@app.get("/tts")
async def tts(
    text: str = Query(..., description="Text to synthesize"),
    voice: str = Query(DEFAULT_VOICE, description="Piper voice model name"),
    length_scale: float = Query(1.0, ge=0.5, le=2.0, description="Speed: 0.5 fast → 2.0 slow"),
    noise_scale: float = Query(0.667, ge=0.0, le=1.0, description="Expressiveness"),
    noise_w: float = Query(0.8, ge=0.0, le=1.0, description="Phoneme duration variation"),
):
    """Synthesize text to speech and stream WAV audio."""
    if not text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")

    model_path = get_model_path(voice)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        cmd = [
            PIPER_BIN,
            "--model", model_path,
            "--length_scale", str(length_scale),
            "--noise_scale", str(noise_scale),
            "--noise_w", str(noise_w),
            "--output_file", tmp_path,
        ]

        result = subprocess.run(
            cmd,
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Piper error: {result.stderr.decode()}"
            )

        with open(tmp_path, "rb") as f:
            audio_bytes = f.read()

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=eve_response.wav",
                "Content-Length": str(len(audio_bytes)),
            },
        )

    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.post("/tts")
async def tts_post(
    text: str = Query(...),
    voice: str = Query(DEFAULT_VOICE),
    length_scale: float = Query(1.0),
    noise_scale: float = Query(0.667),
    noise_w: float = Query(0.8),
):
    """POST variant — same as GET but accepts body params too."""
    return await tts(text, voice, length_scale, noise_scale, noise_w)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5050))
    uvicorn.run(app, host="0.0.0.0", port=port)
