# Trader Mythos Alpha - Dry Run Starter
# Starts freqtrade in dry-run mode + Next.js frontend

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host "=== Trader Mythos Alpha ===" -ForegroundColor Cyan
Write-Host "Starting in DRY RUN mode..." -ForegroundColor Yellow

# Start freqtrade
Write-Host "`nStarting Freqtrade bot..." -ForegroundColor Green
$ftProcess = Start-Process -FilePath "$ROOT\.venv\Scripts\python.exe" -ArgumentList @(
    "-m", "freqtrade", "trade",
    "--config", "$ROOT\freqtrade-develop\user_data\config\config_mythos_dry.json",
    "--strategy", "MythosScalper",
    "--strategy-path", "$ROOT\freqtrade-develop\user_data\strategies",
    "--userdir", "$ROOT\freqtrade-develop\user_data"
) -PassThru -NoNewWindow

Write-Host "Freqtrade PID: $($ftProcess.Id)" -ForegroundColor Gray

# Wait for API to be ready
Write-Host "Waiting for API server..." -ForegroundColor Gray
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/v1/ping" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}

if ($ready) {
    Write-Host "Freqtrade API ready at http://127.0.0.1:8080" -ForegroundColor Green
} else {
    Write-Host "Warning: API not responding yet, continuing..." -ForegroundColor Yellow
}

# Start Next.js
Write-Host "`nStarting Next.js frontend..." -ForegroundColor Green
Set-Location "$ROOT\frontend"
npm run dev
