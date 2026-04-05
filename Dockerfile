# Eve Voice Server — Railway Dockerfile
# Piper TTS + Whisper STT in one container

FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python deps ────────────────────────────────────────────────────────────────
RUN pip install --no-cache-dir \
    fastapi==0.111.0 \
    uvicorn[standard]==0.29.0 \
    pydantic==2.7.0 \
    faster-whisper==1.0.1

# ── Piper binary (Linux x86_64) ────────────────────────────────────────────────
# Check https://github.com/rhasspy/piper/releases for latest version
ENV PIPER_VERSION=2023.11.14-2
RUN mkdir -p /app/piper && \
    wget -q "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz" \
         -O /tmp/piper.tar.gz && \
    tar -xzf /tmp/piper.tar.gz -C /app/piper --strip-components=1 && \
    rm /tmp/piper.tar.gz && \
    chmod +x /app/piper/piper

# ── Download Piper voice model ─────────────────────────────────────────────────
# lessac-medium: natural, warm, suits Eve well
RUN mkdir -p /app/piper/models && \
    wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx" \
         -O /app/piper/models/en_US-lessac-medium.onnx && \
    wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" \
         -O /app/piper/models/en_US-lessac-medium.onnx.json

# ── Copy server ────────────────────────────────────────────────────────────────
COPY combined_server.py .

# ── Env ────────────────────────────────────────────────────────────────────────
ENV PIPER_BIN=/app/piper/piper
ENV PIPER_MODELS_DIR=/app/piper/models
ENV PIPER_DEFAULT_VOICE=en_US-lessac-medium
ENV WHISPER_MODEL=base

# Whisper pre-downloads its model on first run — cache it at build time
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

EXPOSE 5050

CMD ["python", "combined_server.py"]
