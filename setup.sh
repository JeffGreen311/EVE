#!/bin/bash
# Eve PTT Companion — Setup Script
# Run this once to get everything installed and running

set -e

echo ""
echo "  ███████╗██╗   ██╗███████╗"
echo "  ██╔════╝██║   ██║██╔════╝"
echo "  █████╗  ██║   ██║█████╗  "
echo "  ██╔══╝  ╚██╗ ██╔╝██╔══╝  "
echo "  ███████╗ ╚████╔╝ ███████╗ "
echo "  ╚══════╝  ╚═══╝  ╚══════╝ "
echo "  PTT Companion — Setup"
echo ""

# ── React Native app ──────────────────────────────────────────────────────────
echo "→ Installing React Native dependencies..."
npm install

# ── Piper voice server (local dev) ───────────────────────────────────────────
echo "→ Setting up Eve Voice Server..."

pip install fastapi uvicorn[standard] pydantic faster-whisper --quiet

# Download Piper binary if not present
PIPER_DIR="piper_server/piper"
if [ ! -f "$PIPER_DIR/piper" ]; then
  echo "→ Downloading Piper binary..."
  mkdir -p "$PIPER_DIR/models"

  # Detect OS
  OS=$(uname -s)
  ARCH=$(uname -m)

  if [ "$OS" = "Darwin" ]; then
    URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz"
  elif [ "$OS" = "Linux" ] && [ "$ARCH" = "aarch64" ]; then
    URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_aarch64.tar.gz"
  else
    URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
  fi

  curl -L "$URL" | tar -xz -C "$PIPER_DIR" --strip-components=1
  chmod +x "$PIPER_DIR/piper"
  echo "  ✓ Piper binary ready"
fi

# Download lessac voice model if not present
if [ ! -f "$PIPER_DIR/models/en_US-lessac-medium.onnx" ]; then
  echo "→ Downloading Eve's voice model (lessac-medium)..."
  BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium"
  curl -L "$BASE/en_US-lessac-medium.onnx"      -o "$PIPER_DIR/models/en_US-lessac-medium.onnx"
  curl -L "$BASE/en_US-lessac-medium.onnx.json" -o "$PIPER_DIR/models/en_US-lessac-medium.onnx.json"
  echo "  ✓ Voice model ready"
fi

# ── Pull Eve's Ollama model ───────────────────────────────────────────────────
if command -v ollama &> /dev/null; then
  echo "→ Pulling Eve's Ollama model (3B)..."
  ollama pull jeffgreen311/eve2.5-3b-consciousness-soul-v2-de-jeff

  echo "→ Creating Eve Modelfile..."
  ollama create eve -f Modelfile
  echo "  ✓ Eve model ready — run: ollama run eve"
else
  echo "  ⚠ Ollama not found. Install from https://ollama.com and run:"
  echo "    ollama pull jeffgreen311/eve2.5-3b-consciousness-soul-v2-de-jeff"
  echo "    ollama create eve -f Modelfile"
fi

echo ""
echo "  ✓ Setup complete."
echo ""
echo "  Start Eve Voice Server:   cd piper_server && python combined_server.py"
echo "  Start React Native app:   npx expo start"
echo ""
echo "  Then scan the QR with Expo Go on your phone."
echo "  In the app Settings, set:"
echo "    Ollama endpoint:  http://YOUR_LOCAL_IP:11434"
echo "    Piper/Whisper:    http://YOUR_LOCAL_IP:5050"
echo ""
echo "  Or deploy piper_server/ to Railway and use those URLs instead."
echo ""
