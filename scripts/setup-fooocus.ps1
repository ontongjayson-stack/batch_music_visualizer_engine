# Setup & Automated Installer Script for Portable Fooocus AI Background Engine
# Batch Music Visualizer Engine

Param(
    [string]$InstallDir = "$PSScriptRoot\..\tools\Fooocus",
    [int]$Port = 8888,
    [switch]$SkipLaunch
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "🎨 FOOOCUS AI GENERATIVE BACKGROUND ENGINE INSTALLER" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Verify Git & Python Availability
Write-Host "`n1. Checking Environment Dependencies..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is required to install Fooocus. Please install Git and try again."
    Exit 1
}

$pythonCmd = if (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } elseif (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { $null }
if (-not $pythonCmd) {
    Write-Error "Python 3 is required. Please install Python 3.10+ and add it to PATH."
    Exit 1
}
Write-Host "   ✅ Environment check passed: Git and $pythonCmd detected." -ForegroundColor Green

# 2. Clone or Update Fooocus Repository
Write-Host "`n2. Setting Up Fooocus Repository in $InstallDir..." -ForegroundColor Yellow
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path (Split-Path $InstallDir) -Force | Out-Null
    Write-Host "   Cloning Fooocus repository..." -ForegroundColor Gray
    git clone --depth 1 https://github.com/lllyasviel/Fooocus.git $InstallDir
} else {
    Write-Host "   Existing Fooocus directory found at $InstallDir." -ForegroundColor Gray
}

# 3. Create Virtual Environment & Install Dependencies
Set-Location $InstallDir
$venvDir = Join-Path $InstallDir "venv"
if (-not (Test-Path $venvDir)) {
    Write-Host "`n3. Creating Python Virtual Environment..." -ForegroundColor Yellow
    & $pythonCmd -m venv venv
}

$venvPython = Join-Path $venvDir "Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    $venvPython = Join-Path $venvDir "bin/python"
}

Write-Host "   Upgrading pip and installing Fooocus requirements..." -ForegroundColor Gray
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r requirements_versions.txt --extra-index-url https://download.pytorch.org/whl/cu121

# 4. Configure Headless Embedded Mode Execution
Write-Host "`n4. Launching Embedded Fooocus Engine on http://127.0.0.1:$Port..." -ForegroundColor Yellow
Write-Host "   Flags: --always-low-vram --port $Port --listen 127.0.0.1" -ForegroundColor Gray

if (-not $SkipLaunch) {
    $argsList = @("entry_with_update.py", "--always-low-vram", "--port", $Port.ToString(), "--listen", "127.0.0.1")
    Write-Host "`n🚀 Fooocus server initialized. Press Ctrl+C in child window to stop." -ForegroundColor Green
    & $venvPython $argsList
} else {
    Write-Host "   Setup complete. (--SkipLaunch specified)" -ForegroundColor Green
}
