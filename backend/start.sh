#!/bin/bash
# start.sh

# Ensure PORT is exported
export PORT=${PORT:-10000}

# 1. Start Redis in the background with STRICT memory limits
echo "📦 Starting Redis (Slim Mode)..."
redis-server --daemonize yes --maxmemory 32mb --maxmemory-policy allkeys-lru --save "" --appendonly no

# 2. Wait for Redis to be ready
until redis-cli ping >/dev/null 2>&1; do
  echo "Waiting for Redis..."
  sleep 1
done
echo "✅ Redis is ready!"

# 3. Start Celery worker in the background
# We use --pool=solo to save ~100MB of RAM by not forking processes
echo "🚀 Starting Celery worker (solo pool)..."
celery -A hunt_service worker --loglevel=info --concurrency=1 --pool=solo &

# 4. Start FastAPI backend
echo "🚀 Starting FastAPI backend on port $PORT..."
# Use 1 worker to save RAM
exec uvicorn app:app --host 0.0.0.0 --port $PORT --workers 1 --log-level info
