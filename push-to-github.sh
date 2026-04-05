#!/bin/bash
# push-to-github.sh
# Creates the EVE repo on GitHub and pushes everything.
# Requires: gh CLI  →  https://cli.github.com
#
# Usage:
#   bash push-to-github.sh

set -e

REPO_NAME="EVE"
GITHUB_USER="JeffGreen311"

echo ""
echo "  Pushing EVE to GitHub..."
echo ""

# ── Init git if needed ────────────────────────────────────────────────────────
if [ ! -d ".git" ]; then
  git init
  echo "  ✓ Git initialized"
fi

# ── Create repo on GitHub (public) ───────────────────────────────────────────
if gh repo view "$GITHUB_USER/$REPO_NAME" &>/dev/null; then
  echo "  ✓ Repo $GITHUB_USER/$REPO_NAME already exists"
else
  gh repo create "$REPO_NAME" \
    --public \
    --description "Push-to-talk AI companion — Eve's voice, on your phone." \
    --homepage "https://eve-cosmic-dreamscapes.com"
  echo "  ✓ Repo created: github.com/$GITHUB_USER/$REPO_NAME"
fi

# ── Stage everything ──────────────────────────────────────────────────────────
git add .
git diff --cached --quiet && echo "  Nothing new to commit." || {
  git commit -m "feat: EVE PTT companion app — React Native + Piper + Whisper"
  echo "  ✓ Committed"
}

# ── Set remote and push ───────────────────────────────────────────────────────
REMOTE_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"

if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git branch -M main
git push -u origin main

echo ""
echo "  ✓ EVE is live at:"
echo "    https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
