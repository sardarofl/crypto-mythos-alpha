@echo off
title Trader Mythos Alpha - Dry Run
color 0A
echo.
echo  ========================================
echo   TRADER MYTHOS ALPHA - DRY RUN MODE
echo   Paper trading with $100 USDT
echo  ========================================
echo.

cd /d "%~dp0"

echo [1/3] Activating Python environment...
call .venv\Scripts\activate.bat

echo [2/3] Starting Freqtrade bot...
start "Freqtrade Bot" /min cmd /c "cd /d "%~dp0" && call .venv\Scripts\activate.bat && freqtrade trade --config freqtrade-develop\user_data\config\config_mythos_dry.json --strategy MythosScalper --strategy-path freqtrade-develop\user_data\strategies --userdir freqtrade-develop\user_data"

echo Waiting for API to come online...
:wait_api
timeout /t 2 /nobreak >nul
curl -s http://127.0.0.1:8080/api/v1/ping >nul 2>&1
if errorlevel 1 goto wait_api
echo Freqtrade API is LIVE on port 8080!

echo [3/3] Starting web dashboard...
start "Next.js Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for dashboard to come online...
:wait_web
timeout /t 2 /nobreak >nul
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 goto wait_web
echo Dashboard is LIVE on port 3000!

echo.
echo  ========================================
echo   ALL SYSTEMS GO!
echo   Opening dashboard in your browser...
echo  ========================================
echo.
start http://localhost:3000

echo Press any key to STOP everything...
pause >nul

echo.
echo Shutting down...
taskkill /fi "windowtitle eq Freqtrade Bot" /f >nul 2>&1
taskkill /fi "windowtitle eq Next.js Frontend" /f >nul 2>&1
echo Done. Goodbye!
timeout /t 2 >nul
