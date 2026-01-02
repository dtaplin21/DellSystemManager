@echo off
REM Windows Batch Script for Starting AI Service
REM This is a convenience script - the main script is scripts/start-ai-service.js

echo Starting AI Service (Windows)...
echo.

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Run the Node.js wrapper script
node "%SCRIPT_DIR%scripts\start-ai-service.js"

if %errorlevel% neq 0 (
    echo.
    echo Error: Failed to start AI service
    pause
    exit /b %errorlevel%
)

