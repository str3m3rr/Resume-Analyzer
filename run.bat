@echo off
echo 🛸 Starting Cyber-Purple AI Resume Analyzer...

:: Check if Docker is running
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b
)

:: Start the services
echo 🔄 Orchestrating containers...
docker-compose up -d

if %errorlevel% neq 0 (
    echo ❌ Error: Failed to start containers.
    pause
    exit /b
)

echo.
echo ✅ Success! The analyzer is now running.
echo.
echo 🌐 Frontend:  http://localhost:5173
echo ⚙️  Backend:   http://localhost:8000/docs
echo.

:: Open the browser
start http://localhost:5173

echo Press any key to close this terminal (containers will keep running in the background).
pause >nul
