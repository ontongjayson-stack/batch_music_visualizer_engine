@echo off
TITLE Batch Music Visualizer Engine
COLOR 0A
CLS

echo ======================================================
echo    🚀 BATCH MUSIC VISUALIZER ENGINE
echo    Starting Local Web Server and Launching Browser...
echo ======================================================
echo.

:: Launch default web browser to http://localhost:3000
start "" "http://localhost:3000"

:: Execute web server
npx tsx src/web/server.ts

pause
