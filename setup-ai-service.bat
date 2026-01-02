@echo off
REM Windows Batch Script for Setting Up AI Service
REM This is a convenience script - the main script is scripts/setup-ai-service.js

echo Setting up AI Service (Windows)...
echo.

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Run the Node.js wrapper script
node "%SCRIPT_DIR%scripts\setup-ai-service.js"

if %errorlevel% neq 0 (
    echo.
    echo Error: Setup failed
    pause
    exit /b %errorlevel%
)

pause

