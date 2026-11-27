#!/bin/bash
# start.sh

# Ensure PORT is exported
export PORT=${PORT:-8000}

# On Render (which sets RENDER=true), default to single-process low-RAM mode
# unless explicitly overridden (e.g. paid tier with external Redis).
if [ "${RENDER:-false}" = "true" ]; then
    export START_LOCAL_REDIS=${START_LOCAL_REDIS:-false}
    export START_CELERY=${START_CELERY:-false}
else
    export START_LOCAL_REDIS=${START_LOCAL_REDIS:-true}
    export START_CELERY=${START_CELERY:-true}
fi

# 1. Start Redis in the background if enabled (Slim Mode)
if [ "$START_LOCAL_REDIS" = "true" ] && [[ -z "$REDIS_URL" || "$REDIS_URL" == *"127.0.0.1"* || "$REDIS_URL" == *"localhost"* ]]; then
    echo "📦 Starting Redis (Slim Mode)..."
    redis-server --daemonize yes --maxmemory 32mb --maxmemory-policy allkeys-lru --save "" --appendonly no
    echo "⌛ Waiting for Redis..."
    sleep 2
fi

# 2. Start Celery worker in the background if enabled
if [ "$START_CELERY" = "true" ]; then
    echo "🚀 Starting Celery worker (solo pool)..."
    nohup celery -A tasks worker --loglevel=info --concurrency=1 --pool=solo > celery.log 2>&1 &
fi

# 3. Start FastAPI backend
echo "🚀 Starting FastAPI backend on port $PORT..."
exec python -m uvicorn app:app --host 0.0.0.0 --port "$PORT" --workers 1 --log-level info
