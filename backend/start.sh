#!/bin/bash

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
# We use concurrency 1 to keep RAM usage low on free tiers
echo "🚀 Starting Celery worker..."
celery -A hunt_service worker --loglevel=info --concurrency=1 &

# Start the FastAPI application
echo "🚀 Starting FastAPI backend..."
python -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000}
