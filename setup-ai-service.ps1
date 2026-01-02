# PowerShell Script for Setting Up AI Service
# This is a convenience script - the main script is scripts/setup-ai-service.js

Write-Host "🔧 Setting up AI Service (Windows PowerShell)..." -ForegroundColor Cyan
Write-Host ""

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Run the Node.js wrapper script
$nodeScript = Join-Path $scriptDir "scripts\setup-ai-service.js"

if (-not (Test-Path $nodeScript)) {
    Write-Host "❌ Error: Could not find setup-ai-service.js at $nodeScript" -ForegroundColor Red
    exit 1
}

node $nodeScript

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error: Setup failed" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

