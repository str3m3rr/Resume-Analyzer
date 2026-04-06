#!/bin/bash
# start.sh

# Ensure PORT is exported
export PORT=${PORT:-10000}

# Start Redis server in the background
echo "🚀 Starting Redis server..."
redis-server --daemonize yes

# Wait for Redis to be ready
until redis-cli ping >/dev/null 2>&1; do
  echo "Waiting for Redis..."
  sleep 1
done
echo "✅ Redis is ready!"

# Start Celery worker in the background
echo "🚀 Starting Celery worker (concurrency=1)..."
celery -A hunt_service worker --loglevel=info --concurrency=1 &

# Start the FastAPI application
echo "🚀 Starting FastAPI backend on port $PORT..."
# Use exec to ensure signals are passed to uvicorn
exec uvicorn app:app --host 0.0.0.0 --port $PORT --log-level info
