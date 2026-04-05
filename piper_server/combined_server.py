"""
Eve Voice Server — Combined Piper TTS + Whisper STT
One FastAPI service, one Railway deployment, two endpoints.

Routes:
  GET  /tts?text=...&voice=...&length_scale=...&noise_scale=...&noise_w=...
  POST /transcribe   { audio_base64: str, language: str }
  GET  /health
  GET  /voices

Env vars:
  PIPER_BIN          path to piper binary          (default: ./piper/piper)
  PIPER_MODELS_DIR   dir containing .onnx files    (default: ./piper/models)
  PIPER_DEFAULT_VOICE                               (default: en_US-lessac-medium)
  WHISPER_MODEL      tiny | base | small | medium   (default: base)
  PORT               injected by Railway
"""

import base64
import io
import os
import subprocess
import tempfile
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="Eve Voice Server", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Config ────────────────────────────────────────────────────────────────────
PIPER_BIN         = os.getenv("PIPER_BIN", "./piper/piper")
MODELS_DIR        = Path(os.getenv("PIPER_MODELS_DIR", "./piper/models"))
DEFAULT_VOICE     = os.getenv("PIPER_DEFAULT_VOICE", "en_US-lessac-medium")
WHISPER_MODEL_SZ  = os.getenv("WHISPER_MODEL", "base")

# Edge TTS (Microsoft neural voices — free, fast, natural)
EDGE_DEFAULT_VOICE = os.getenv("EDGE_DEFAULT_VOICE", "en-US-JennyNeural")

# ── Load Whisper once ─────────────────────────────────────────────────────────
print(f"[Eve Voice] Loading Whisper '{WHISPER_MODEL_SZ}'…")
from faster_whisper import WhisperModel
whisper = WhisperModel(WHISPER_MODEL_SZ, device="cpu", compute_type="int8")
print("[Eve Voice] Whisper ready.")

# ── Edge TTS (no model to load — streams from Microsoft) ─────────────────────
import edge_tts
print(f"[Eve Voice] Edge TTS ready with voice '{EDGE_DEFAULT_VOICE}'.")


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_model_path(voice: str) -> str:
    path = MODELS_DIR / f"{voice}.onnx"
    if not path.exists():
        raise HTTPException(404, f"Voice '{voice}' not found. Available: {list_voice_names()}")
    return str(path)


def list_voice_names() -> list[str]:
    if not MODELS_DIR.exists():
        return []
    return sorted(p.stem for p in MODELS_DIR.glob("*.onnx"))


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "whisper_model": WHISPER_MODEL_SZ,
        "voices": list_voice_names(),
        "default_voice": DEFAULT_VOICE,
    }


@app.get("/voices")
async def voices():
    # Popular US female voices for Eve
    recommended = [
        "en-US-JennyNeural",     # warm, conversational (default)
        "en-US-AriaNeural",      # professional, clear
        "en-US-MichelleNeural",  # young, energetic
        "en-US-AshleyNeural",    # modern, expressive
        "en-US-CoraNeural",      # calm, steady
        "en-US-EmmaNeural",      # soft, intimate
        "en-US-AvaNeural",       # friendly, bright
        "en-US-NancyNeural",     # mature, warm
    ]
    return {
        "engine": "edge-tts",
        "default_voice": EDGE_DEFAULT_VOICE,
        "recommended": recommended,
    }


# ── TTS (Edge — Microsoft neural voices) ─────────────────────────────────────
@app.get("/tts")
async def tts(
    text: str   = Query(..., description="Text to speak"),
    voice: str  = Query(None, description="Edge TTS voice (e.g. en-US-JennyNeural)"),
    rate: str   = Query("+0%", description="Speech rate (e.g. -10%, +20%)"),
    pitch: str  = Query("+0Hz", description="Pitch adjustment (e.g. -5Hz, +10Hz)"),
    # Legacy params (ignored, kept for URL compatibility)
    speed: float = Query(None),
    length_scale: float = Query(None),
    noise_scale: float  = Query(None),
    noise_w: float      = Query(None),
):
    if not text.strip():
        raise HTTPException(400, "text is empty")

    voice = voice or EDGE_DEFAULT_VOICE

    # Convert legacy speed/length_scale to Edge rate
    if speed and speed != 1.0:
        rate = f"{int((speed - 1.0) * 100):+d}%"
    elif length_scale and length_scale != 1.0:
        rate = f"{int((1.0/length_scale - 1.0) * 100):+d}%"

    try:
        communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        audio = b"".join(chunks)

        return StreamingResponse(
            io.BytesIO(audio),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=eve.mp3",
                "Content-Length": str(len(audio)),
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        raise HTTPException(500, f"Edge TTS failed: {e}")


# ── STT ───────────────────────────────────────────────────────────────────────
class TranscribeRequest(BaseModel):
    audio_base64: str
    language: str = "en"


@app.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    try:
        audio_bytes = base64.b64decode(req.audio_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 audio")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        segments, info = whisper.transcribe(
            tmp_path,
            language=req.language,
            beam_size=3,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300},
        )
        text = " ".join(s.text.strip() for s in segments).strip()
        return {"text": text, "language": info.language, "duration": round(info.duration, 2)}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        Path(tmp_path).unlink(missing_ok=True)


# ── Ollama Proxy ─────────────────────────────────────────────────────────────
# Proxies /api/chat to the configured Ollama endpoint so the browser
# never needs to make cross-origin HTTP requests to a local IP.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "eve")
_model_ready = False

# Pull model in background so server starts immediately
import threading

def _pull_model_bg():
    global _model_ready
    import httpx as _httpx
    for attempt in range(12):
        try:
            resp = _httpx.get(f"{OLLAMA_URL}/api/tags", timeout=10)
            models = [m.get("name", "") for m in resp.json().get("models", [])]
            if any(OLLAMA_MODEL.split(":")[0] in m for m in models):
                print(f"[Eve] Model '{OLLAMA_MODEL}' already available.")
                _model_ready = True
                return
            print(f"[Eve] Pulling model '{OLLAMA_MODEL}'... (this may take a few minutes)")
            with _httpx.stream("POST", f"{OLLAMA_URL}/api/pull", json={"name": OLLAMA_MODEL}, timeout=600) as r:
                for line in r.iter_lines():
                    pass
            print(f"[Eve] Model pull complete.")
            _model_ready = True
            return
        except Exception as e:
            print(f"[Eve] Ollama not ready (attempt {attempt+1}/12): {e}")
            import time; time.sleep(10)
    print("[Eve] WARNING: Could not pull model after all attempts.")

threading.Thread(target=_pull_model_bg, daemon=True).start()


@app.post("/api/chat")
async def proxy_ollama_chat(request: Request):
    body = await request.body()
    try:
        client = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0))
        req = client.build_request(
            "POST",
            f"{OLLAMA_URL}/api/chat",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        resp = await client.send(req, stream=True)

        async def stream_response():
            try:
                async for chunk in resp.aiter_bytes():
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_response(),
            status_code=resp.status_code,
            media_type=resp.headers.get("content-type", "application/json"),
        )
    except httpx.ConnectError:
        raise HTTPException(502, f"Cannot reach Ollama at {OLLAMA_URL}")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/tags")
async def proxy_ollama_tags():
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            return StreamingResponse(
                io.BytesIO(resp.content),
                status_code=resp.status_code,
                media_type="application/json",
            )
    except httpx.ConnectError:
        raise HTTPException(502, f"Cannot reach Ollama at {OLLAMA_URL}")


# ── Web App ──────────────────────────────────────────────────────────────────
WEB_APP = Path(__file__).parent / "index.html"

@app.get("/", response_class=HTMLResponse)
def serve_web_app():
    if WEB_APP.exists():
        return HTMLResponse(WEB_APP.read_text())
    return HTMLResponse("<h1>Eve Voice Server</h1><p>Web app not found.</p>")


# ── Entry ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 5050)))
