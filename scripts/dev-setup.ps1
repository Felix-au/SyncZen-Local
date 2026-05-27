# dev-setup.ps1
# One-shot developer environment bootstrap for the Hotel Check-In project.
# Run from repository root: .\scripts\dev-setup.ps1

$ErrorActionPreference = "Stop"

# Resolve script directory or fallback gracefully
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    if ($MyInvocation -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
        $ScriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
    } else {
        $ScriptDir = $PWD.Path
    }
}

# Determine the repository root directory
if (Test-Path "$ScriptDir\setup-mariadb.ps1") {
    $Root = Split-Path $ScriptDir -Parent
    $ScriptsPath = $ScriptDir
} elseif (Test-Path "$ScriptDir\scripts\setup-mariadb.ps1") {
    $Root = $ScriptDir
    $ScriptsPath = "$Root\scripts"
} else {
    # Check if we are running from inside the desktop/mobile or somewhere else
    $Root = $PWD.Path
    if (-not (Test-Path "$Root\desktop") -and (Test-Path "$Root\..\desktop")) {
        $Root = Split-Path $Root -Parent
    }
    $ScriptsPath = "$Root\scripts"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Hotel Check-In - Developer Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check Node.js ────────────────────────────────────────────────────────
Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = node --version
    Write-Host "      [OK] Node.js $nodeVer detected" -ForegroundColor Green
} catch {
    Write-Host "      [ERROR] Node.js not found. Install from https://nodejs.org (LTS)" -ForegroundColor Red
    exit 1
}

# ── 2. Install Desktop dependencies ─────────────────────────────────────────
Write-Host "`n[2/4] Installing desktop dependencies..." -ForegroundColor Yellow
Set-Location "$Root\desktop"
npm install
Write-Host "      [OK] Desktop node_modules installed" -ForegroundColor Green

# ── 3. Install Mobile dependencies ──────────────────────────────────────────
Write-Host "`n[3/4] Installing mobile dependencies..." -ForegroundColor Yellow
Set-Location "$Root\mobile"
npm install
Write-Host "      [OK] Mobile node_modules installed" -ForegroundColor Green

# ── 4. Download MariaDB portable binaries ────────────────────────────────────
Write-Host "`n[4/4] Setting up portable MariaDB engine..." -ForegroundColor Yellow
Set-Location $Root
& "$ScriptsPath\setup-mariadb.ps1"

# ── Done ────────────────────────────────────────────────────────────────────
Set-Location $Root
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Setup complete! Next steps:" -ForegroundColor Green
Write-Host ""
Write-Host "  Desktop:  cd desktop && npm run dev" -ForegroundColor Green
Write-Host "  Mobile:   cd mobile  && npx expo start" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
