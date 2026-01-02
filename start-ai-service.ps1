# PowerShell Script for Starting AI Service
# This is a convenience script - the main script is scripts/start-ai-service.js

Write-Host "🚀 Starting AI Service (Windows PowerShell)..." -ForegroundColor Cyan
Write-Host ""

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Run the Node.js wrapper script
$nodeScript = Join-Path $scriptDir "scripts\start-ai-service.js"

if (-not (Test-Path $nodeScript)) {
    Write-Host "❌ Error: Could not find start-ai-service.js at $nodeScript" -ForegroundColor Red
    exit 1
}

node $nodeScript

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error: Failed to start AI service" -ForegroundColor Red
    exit $LASTEXITCODE
}

