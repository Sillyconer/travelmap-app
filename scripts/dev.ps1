# TravelMap — Dev Server Script
# Starts both the FastAPI backend and Vite frontend concurrently.

$BackendDir = "backend"
$FrontendDir = "frontend"

Write-Host "Starting TravelMap Development Servers..." -ForegroundColor Cyan

# 1. Start Backend in a background job
Write-Host "→ Starting FastAPI on port 8000..." -ForegroundColor Green
$BackendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & ".\.venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
} -ArgumentList $BackendDir

# Give it a second to bind
Start-Sleep -Seconds 2

# 2. Start Frontend blocking the main thread
Write-Host "→ Starting Vite on port 5173..." -ForegroundColor Green
Set-Location $FrontendDir
npm run dev

# Cleanup when user stops Vite (Ctrl+C)
Write-Host "Cleaning up backend process..." -ForegroundColor Yellow
Stop-Job -Job $BackendJob
Remove-Job -Job $BackendJob
