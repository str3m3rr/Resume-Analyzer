@echo off
echo 🛑 Stopping Cyber-Purple AI Resume Analyzer...

:: Check if Docker is running
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b
)

echo 🔄 Bringing down containers...
docker-compose down

if %errorlevel% eq 0 (
    echo.
    echo ✅ Services stopped successfully.
) else (
    echo.
    echo ⚠️  Something went wrong while stopping services.
)

pause
