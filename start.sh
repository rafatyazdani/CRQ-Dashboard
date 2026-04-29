#!/usr/bin/env bash
# Quick-start script — runs backend and frontend concurrently.
# Requires: Python 3.10+, Node.js 18+

set -e

# ── Backend ──────────────────────────────────────────────────────────────────
echo "→ Installing Python dependencies…"
cd backend
python -m venv .venv 2>/dev/null || true
source .venv/Scripts/activate 2>/dev/null || source .venv/bin/activate
pip install -r requirements.txt -q
echo "→ Starting FastAPI backend on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "→ Installing Node dependencies…"
cd frontend
npm install -q
cp -n .env.example .env 2>/dev/null || true
echo "→ Starting Vite dev server on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "  Consultant Portal  →  http://localhost:5173/consultant"
echo "  Client Dashboard   →  http://localhost:5173/dashboard/nexus-financial"
echo "  API Docs           →  http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
