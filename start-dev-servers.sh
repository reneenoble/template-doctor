#!/usr/bin/env bash
# Start both Express backend and Vite preview for OAuth testing on port 3000

set -e

echo "🚀 Starting Template Doctor Development Servers"
echo "================================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found in root directory"
  echo "   Copy .env.example to .env and configure your tokens"
  exit 1
fi

# Check if Express server needs .env symlink
if [ ! -f packages/server/.env ] && [ ! -L packages/server/.env ]; then
  echo "📝 Creating .env symlink for Express server..."
  ln -s ../../.env packages/server/.env
  echo "✅ Symlink created"
else
  echo "✅ Express server .env configured"
fi

# Function to cleanup background processes on exit
cleanup() {
  echo ""
  echo "🛑 Stopping servers..."
  jobs -p | xargs -r kill 2>/dev/null || true
  echo "✅ Servers stopped"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start Express backend
echo "1️⃣ Starting Express backend (port 3001)..."
cd packages/server
npm run dev > /tmp/express-dev.log 2>&1 &
EXPRESS_PID=$!
cd ../..

# Wait for backend to be ready
echo "   Waiting for backend..."
for i in {1..10}; do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend ready on http://localhost:3001"
    break
  fi
  sleep 1
  if [ $i -eq 10 ]; then
    echo "   ❌ Backend failed to start. Check /tmp/express-dev.log"
    tail -20 /tmp/express-dev.log
    exit 1
  fi
done

# Start Vite preview
echo ""
echo "2️⃣ Starting Vite preview (port 3000)..."
cd packages/app

# Build first (required for preview)
echo "   Building frontend..."
npm run build > /tmp/vite-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "   ❌ Build failed. Check /tmp/vite-build.log"
  tail -20 /tmp/vite-build.log
  exit 1
fi

npm run preview > /tmp/vite-preview.log 2>&1 &
VITE_PID=$!
cd ../..

# Wait for frontend to be ready
echo "   Waiting for frontend..."
for i in {1..10}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "   ✅ Frontend ready on http://localhost:3000"
    break
  fi
  sleep 1
  if [ $i -eq 10 ]; then
    echo "   ❌ Frontend failed to start. Check /tmp/vite-preview.log"
    tail -20 /tmp/vite-preview.log
    exit 1
  fi
done

echo ""
echo "✅ All servers running!"
echo ""
echo "📊 Dashboard:     http://localhost:3000"
echo "🔐 OAuth Callback: http://localhost:3000/callback.html"
echo "⚙️  Backend API:   http://localhost:3001"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/express-dev.log"
echo "   Frontend: tail -f /tmp/vite-preview.log"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Keep script running and show logs
tail -f /tmp/express-dev.log /tmp/vite-preview.log
