@echo off
title Trader Mythos - Shutdown
color 0C
echo.
echo  Stopping Trader Mythos...
echo.
taskkill /fi "windowtitle eq Freqtrade Bot" /f >nul 2>&1
taskkill /fi "windowtitle eq Next.js Frontend" /f >nul 2>&1
echo  All processes stopped.
timeout /t 2 >nul
