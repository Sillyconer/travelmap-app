# TravelMap — Build Script
# Builds the frontend and outputs it for production serving via FastAPI.

$FrontendDir = "frontend"

Write-Host "Building TravelMap..." -ForegroundColor Cyan

Set-Location $FrontendDir
npm run build

Write-Host "✓ Build complete. Ready to run 'python main.py' in backend." -ForegroundColor Green
