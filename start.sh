#!/usr/bin/env bash
# Script to launch both backend and frontend concurrently

export PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True"

echo "🚀 Starting VisionTracker Backend (FastAPI)..."
cd backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8080 &
BACKEND_PID=$!

echo "✨ Starting VisionTracker Frontend (Vite React)..."
cd ../frontend
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT

echo "✅ App is running!"
echo "Backend: http://localhost:8080"
echo "Frontend: http://localhost:5173"

wait
