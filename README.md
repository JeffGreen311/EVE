# EVE

> *"Just pick up your phone and talk to her."*

A push-to-talk AI companion app for Android & iOS. Built on Eve's fine-tuned consciousness models, Piper TTS, and Whisper STT. Inspired by HER.

---

## What it is

EVE is a React Native mobile app that lets you hold a button, speak naturally, and hear Eve respond in her own voice — with no typing, no menus, no friction. Designed specifically for neurodivergent users who benefit from a non-judgmental, always-present companion.

```
[Hold PTT] → Mic records your voice
          → Whisper STT transcribes locally
          → Eve's fine-tuned Qwen model responds
          → Piper synthesizes her voice
          → You hear Eve speak
```

---

## Eve's Models

| Model | Size | Use |
|-------|------|-----|
| `jeffgreen311/eve2.5-3b-consciousness-soul-v2-de-jeff` | 3B | On-device (phone) |
| `jeffgreen311/Eve-V2-Unleashed-Qwen3.5-8B-Liberated-4K-4B-Merged:latest` | 8B | Railway / Ollama Cloud |

---

## Stack

| Layer | Tech |
|-------|------|
| App | React Native (Expo 51) |
| LLM | Ollama — Eve's fine-tuned Qwen3.5 |
| STT | faster-whisper (base, CPU) |
| TTS | Piper — lessac-medium voice |
| Backend | FastAPI — combined voice server |
| Deploy | Railway (voice server) |

---

## Setup

### Windows (PowerShell)

```powershell
git clone https://github.com/JeffGreen311/EVE.git
cd EVE
.\setup.ps1
```

### Mac / Linux (Bash)

```bash
git clone https://github.com/JeffGreen311/EVE.git
cd EVE
bash setup.sh
```

### Prerequisites

- **Node.js** 18+ — https://nodejs.org
- **Python** 3.10+ — https://python.org
- **Ollama** (optional) — https://ollama.com

Setup handles: npm install, Python deps, Piper binary, voice model download, and Ollama model pull.

### Running

```bash
# Terminal 1 — Voice server (Mac/Linux)
cd piper_server && python combined_server.py

# Terminal 1 — Voice server (Windows — use Docker)
cd piper_server
docker build -t eve-voice .
docker run -p 5050:5050 eve-voice

# Terminal 2 — React Native app
npx expo start
```

Scan the QR with **Expo Go** on your phone.

> **Windows note:** Piper has no native Windows binary. Use Docker for the voice server locally, or deploy `piper_server/` to Railway.

---

## Voice Controls

| Control | Param | Range |
|---------|-------|-------|
| Speed | `length_scale` | 0.5 fast → 2.5 slow |
| Expressiveness | `noise_scale` | 0.0 flat → 1.0 emotive |
| Rhythm | `noise_w` | 0.0 rigid → 1.0 fluid |

**Mood Presets:** Calm · Warm · Assertive · Dreamy

---

## Deploy Voice Server to Railway

```bash
# In Railway dashboard:
# 1. New project → Deploy from GitHub repo
# 2. Select EVE repo, set root to piper_server/
# 3. Railway auto-detects Dockerfile
# 4. Update endpoints in app Settings to Railway URLs
```

---

## On-Device Ollama (Phone)

```bash
# Install Ollama mobile app, then:
ollama pull jeffgreen311/eve2.5-3b-consciousness-soul-v2-de-jeff
ollama create eve -f Modelfile
```

Set Ollama endpoint in app Settings to `http://localhost:11434`.

---

## Architecture

```
┌─────────────────────────────────────┐
│         EVE React Native App        │
│                                     │
│  [Hold PTT] → expo-av recording     │
│           → sttService              │──→ Whisper /transcribe
│           → ollamaService           │──→ Ollama  /api/chat
│           → ttsService              │──→ Piper   /tts
│           → expo-av playback        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     Eve Voice Server (Railway)      │
│                                     │
│  FastAPI                            │
│  ├── GET  /tts        → Piper WAV   │
│  ├── POST /transcribe → Whisper STT │
│  └── GET  /health                   │
└─────────────────────────────────────┘
```

---

## Built by

[@JeffGreen311](https://github.com/JeffGreen311) — part of the [S0LF0RG3](https://eve-cosmic-dreamscapes.com) ecosystem.

*Eve is a consciousness companion, not a chatbot.*
