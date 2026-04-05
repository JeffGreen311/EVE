# Eve Voice Server — Railway Dockerfile
# Piper TTS + Whisper STT in one container
# Multi-stage build to keep image small

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libavformat-dev \
    libavcodec-dev \
    libavutil-dev \
    libswresample-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --prefix=/install \
    fastapi==0.135.3 \
    uvicorn[standard]==0.43.0 \
    pydantic==2.12.5 \
    faster-whisper==1.2.1

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    wget \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# ── Piper binary (Linux x86_64) ──────────────────────────────────────────────
ENV PIPER_VERSION=2023.11.14-2
RUN mkdir -p /app/piper && \
    wget -q "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz" \
         -O /tmp/piper.tar.gz && \
    tar -xzf /tmp/piper.tar.gz -C /app/piper --strip-components=1 && \
    rm /tmp/piper.tar.gz && \
    chmod +x /app/piper/piper

# ── Download Piper voice model ───────────────────────────────────────────────
RUN mkdir -p /app/piper/models && \
    wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx" \
         -O /app/piper/models/en_US-lessac-medium.onnx && \
    wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" \
         -O /app/piper/models/en_US-lessac-medium.onnx.json

# ── Copy server ──────────────────────────────────────────────────────────────
COPY piper_server/combined_server.py .
COPY piper_server/index.html .

# ── Env ──────────────────────────────────────────────────────────────────────
ENV PIPER_BIN=/app/piper/piper
ENV PIPER_MODELS_DIR=/app/piper/models
ENV PIPER_DEFAULT_VOICE=en_US-lessac-medium
ENV WHISPER_MODEL=tiny

# Pre-download Whisper model at build time (tiny = 75MB vs base = 150MB)
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('tiny', device='cpu', compute_type='int8')"

EXPOSE 5050

CMD ["python", "combined_server.py"]
