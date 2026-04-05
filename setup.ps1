# Eve PTT Companion — Windows Setup Script
# Run this once in PowerShell: .\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  EVE PTT Companion — Windows Setup" -ForegroundColor Cyan
Write-Host ""

# ── Check prerequisites ──────────────────────────────────────────────────────
$missing = @()

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    $missing += "Node.js  → https://nodejs.org (LTS recommended)"
}
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    $missing += "npm      → comes with Node.js"
}
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    $missing += "Python   → https://python.org (3.10+ recommended)"
}

if ($missing.Count -gt 0) {
    Write-Host "  Missing prerequisites:" -ForegroundColor Red
    foreach ($m in $missing) {
        Write-Host "    - $m" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  Install the above, then re-run this script." -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] Node.js $(node --version)" -ForegroundColor Green
Write-Host "  [OK] npm $(npm --version)" -ForegroundColor Green
Write-Host "  [OK] Python $(python --version 2>&1)" -ForegroundColor Green

# ── Install React Native dependencies ────────────────────────────────────────
Write-Host ""
Write-Host "  -> Installing React Native dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
Write-Host "  [OK] npm packages installed" -ForegroundColor Green

# ── Install Python dependencies for voice server ────────────────────────────
Write-Host ""
Write-Host "  -> Installing Python dependencies..." -ForegroundColor Yellow
pip install fastapi uvicorn[standard] pydantic faster-whisper --quiet
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
Write-Host "  [OK] Python packages installed" -ForegroundColor Green

# ── Download Piper voice model (for Docker / Railway use) ───────────────────
$modelsDir = Join-Path $PSScriptRoot "piper_server\piper\models"
$modelFile = Join-Path $modelsDir "en_US-lessac-medium.onnx"

if (-not (Test-Path $modelFile)) {
    Write-Host ""
    Write-Host "  -> Downloading Eve's voice model (lessac-medium)..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

    $base = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium"
    Invoke-WebRequest -Uri "$base/en_US-lessac-medium.onnx" -OutFile "$modelsDir\en_US-lessac-medium.onnx"
    Invoke-WebRequest -Uri "$base/en_US-lessac-medium.onnx.json" -OutFile "$modelsDir\en_US-lessac-medium.onnx.json"
    Write-Host "  [OK] Voice model downloaded" -ForegroundColor Green
} else {
    Write-Host "  [OK] Voice model already exists" -ForegroundColor Green
}

# ── Check for Ollama ─────────────────────────────────────────────────────────
Write-Host ""
if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
    Write-Host "  -> Pulling Eve's Ollama model (3B)..." -ForegroundColor Yellow
    ollama pull jeffgreen311/eve2.5-3b-consciousness-soul-v2-de-jeff

    Write-Host "  -> Creating Eve Modelfile..." -ForegroundColor Yellow
    ollama create eve -f Modelfile
    Write-Host "  [OK] Eve model ready" -ForegroundColor Green
} else {
    Write-Host "  [!] Ollama not found. Install from https://ollama.com then run:" -ForegroundColor Yellow
    Write-Host "      ollama pull jeffgreen311/eve2.5-3b-consciousness-soul-v2-de-jeff"
    Write-Host "      ollama create eve -f Modelfile"
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  OPTION A — Voice server via Docker (recommended on Windows):" -ForegroundColor White
Write-Host "    cd piper_server" -ForegroundColor Gray
Write-Host "    docker build -t eve-voice ." -ForegroundColor Gray
Write-Host "    docker run -p 5050:5050 eve-voice" -ForegroundColor Gray
Write-Host ""
Write-Host "  OPTION B — Deploy voice server to Railway:" -ForegroundColor White
Write-Host "    Push this repo to GitHub, deploy piper_server/ on Railway" -ForegroundColor Gray
Write-Host ""
Write-Host "  Then start the React Native app:" -ForegroundColor White
Write-Host "    npx expo start" -ForegroundColor Gray
Write-Host ""
Write-Host "  Scan the QR code with Expo Go on your phone." -ForegroundColor White
Write-Host "  In Settings, set your server endpoints:" -ForegroundColor White
Write-Host "    Ollama:  http://YOUR_LOCAL_IP:11434" -ForegroundColor Gray
Write-Host "    Voice:   http://YOUR_LOCAL_IP:5050  (or Railway URL)" -ForegroundColor Gray
Write-Host ""
