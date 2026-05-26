# setup-mariadb.ps1
# Downloads portable MariaDB 11.x and places it into desktop/db-engine/bin/
# Run from the repository root: .\scripts\setup-mariadb.ps1

param(
    [string]$Version = "11.4.5",
    [string]$Arch    = "winx64"
)

$ErrorActionPreference = "Stop"

$FileName   = "mariadb-$Version-$Arch.zip"
$DownloadUrl = "https://downloads.mariadb.org/rest-api/mariadb/$Version/$FileName"
$TempDir    = "$env:TEMP\mariadb-setup"
$ZipPath    = "$TempDir\$FileName"
$ExtractDir = "$TempDir\extracted"
# Resolve script directory or fallback gracefully
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    if ($MyInvocation -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
        $ScriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
    } else {
        $ScriptDir = $PWD.Path
    }
}

# Determine target directory relative to root
if (Test-Path "$ScriptDir\setup-mariadb.ps1") {
    $TargetDir = "$ScriptDir\..\desktop\db-engine\bin"
} elseif (Test-Path "$ScriptDir\scripts\setup-mariadb.ps1") {
    $TargetDir = "$ScriptDir\desktop\db-engine\bin"
} else {
    $TargetDir = "$ScriptDir\desktop\db-engine\bin"
}

Write-Host "`n[MariaDB Setup] Version: $Version  Arch: $Arch" -ForegroundColor Cyan
Write-Host "[MariaDB Setup] Target:  $TargetDir`n"

# ── 1. Check if already present ────────────────────────────────────────────
if (Test-Path "$TargetDir\mysqld.exe") {
    Write-Host "[MariaDB Setup] ✓ mysqld.exe already exists. Nothing to do." -ForegroundColor Green
    exit 0
}

# ── 2. Resolve actual download URL from MariaDB REST API ────────────────────
Write-Host "[MariaDB Setup] Resolving download URL..." -ForegroundColor Yellow
try {
    $ApiUrl  = "https://downloads.mariadb.org/rest-api/mariadb/$Version/"
    $ApiData = Invoke-RestMethod -Uri $ApiUrl -TimeoutSec 30
    $FileEntry = $ApiData.files | Where-Object { $_.file_name -like "mariadb-*-$Arch.zip" } | Select-Object -First 1
    if ($FileEntry) {
        $DownloadUrl = $FileEntry.file_download_url
        $FileName    = $FileEntry.file_name
        $ZipPath     = "$TempDir\$FileName"
        Write-Host "[MariaDB Setup] Found: $FileName"
    }
} catch {
    Write-Host "[MariaDB Setup] API lookup failed, using default URL: $DownloadUrl" -ForegroundColor Yellow
}

# ── 3. Create temp directory ────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $TempDir    | Out-Null
New-Item -ItemType Directory -Force -Path $ExtractDir | Out-Null
New-Item -ItemType Directory -Force -Path $TargetDir  | Out-Null

# ── 4. Download ZIP ─────────────────────────────────────────────────────────
if (-Not (Test-Path $ZipPath)) {
    Write-Host "[MariaDB Setup] Downloading $FileName (~120 MB)..." -ForegroundColor Yellow
    $ProgressPreference = 'SilentlyContinue'   # Speeds up Invoke-WebRequest
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -TimeoutSec 300
    Write-Host "[MariaDB Setup] Download complete."
} else {
    Write-Host "[MariaDB Setup] Using cached ZIP: $ZipPath"
}

# ── 5. Extract ZIP ──────────────────────────────────────────────────────────
Write-Host "[MariaDB Setup] Extracting..."
Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

# ── 6. Copy bin/ to target ──────────────────────────────────────────────────
$ExtractedRoot = Get-ChildItem $ExtractDir -Directory | Select-Object -First 1
$BinSource     = "$($ExtractedRoot.FullName)\bin"

if (-Not (Test-Path $BinSource)) {
    Write-Host "[MariaDB Setup] ✗ Could not find bin/ in extracted archive." -ForegroundColor Red
    exit 1
}

Write-Host "[MariaDB Setup] Copying bin/ to $TargetDir..."
Copy-Item -Path "$BinSource\*" -Destination $TargetDir -Recurse -Force

# ── 7. Verify ───────────────────────────────────────────────────────────────
if (Test-Path "$TargetDir\mysqld.exe") {
    Write-Host "`n[MariaDB Setup] ✓ Success! mysqld.exe is ready at:" -ForegroundColor Green
    Write-Host "    $TargetDir\mysqld.exe`n"
} else {
    Write-Host "[MariaDB Setup] ✗ mysqld.exe not found after extraction." -ForegroundColor Red
    exit 1
}

# ── 8. Clean up temp files ──────────────────────────────────────────────────
Remove-Item -Recurse -Force $ExtractDir
Write-Host "[MariaDB Setup] Temp files cleaned up. You can delete $ZipPath if no longer needed."
