#!/bin/bash

# Start SwapFlow locally
# This script starts both backend and frontend servers

echo "🚀 Starting SwapFlow Local Development..."

# Check if .env files exist
if [ ! -f "backend/.env" ] && [ ! -f "backend/.env.local" ]; then
    echo "⚠️  Warning: backend/.env or backend/.env.local not found"
    echo "   Please create backend/.env with your MongoDB and Google OAuth credentials"
    echo "   See SETUP_LOCAL.md for details"
fi

if [ ! -f "frontend/.env" ] && [ ! -f "frontend/.env.local" ]; then
    echo "⚠️  Warning: frontend/.env or frontend/.env.local not found"
    echo "   Please create frontend/.env with your backend URL and Google OAuth credentials"
    echo "   See SETUP_LOCAL.md for details"
fi

# Start backend in background
echo "📦 Starting backend server on http://localhost:8000..."
cd backend
python -m uvicorn server:app --reload --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start. Check backend.log for errors"
    exit 1
fi

echo "✅ Backend started (PID: $BACKEND_PID)"

# Start frontend
echo "🎨 Starting frontend server on http://localhost:3000..."
cd frontend
npm start

# When frontend stops, kill backend
echo "🛑 Stopping backend server..."
kill $BACKEND_PID 2>/dev/null
cd ..

echo "👋 Development servers stopped"

