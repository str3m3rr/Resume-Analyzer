#!/bin/bash
# start.sh

# Ensure PORT is exported
export PORT=${PORT:-10000}

# 1. Start Redis in the background with STRICT memory limits
echo "📦 Starting Redis (Slim Mode)..."
redis-server --daemonize yes --maxmemory 32mb --maxmemory-policy allkeys-lru --save "" --appendonly no

# 2. Wait for Redis to be ready (short timeout)
echo "⌛ Waiting for Redis..."
sleep 2

# 3. Start Celery worker in the background using nohup
# We use nohup to ensure it doesn't block the shell or get killed if the shell ends
echo "🚀 Starting Celery worker (solo pool)..."
nohup celery -A hunt_service worker --loglevel=info --concurrency=1 --pool=solo > celery.log 2>&1 &

# 4. Start FastAPI backend (The most important part for Render)
echo "🚀 Starting FastAPI backend on port $PORT..."
# Using python -m uvicorn for better signal handling and ensured import path
exec python -m uvicorn app:app --host 0.0.0.0 --port $PORT --workers 1 --log-level info
