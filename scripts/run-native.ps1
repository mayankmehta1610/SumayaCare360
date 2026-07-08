# Native Windows runner (no Docker) — use when virtualization is disabled in BIOS
param(
    [switch]$InstallOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Venv = Join-Path $Backend ".venv"

function Ensure-Winget($id, $name) {
    $p = Get-Command $name -ErrorAction SilentlyContinue
    if ($p -and $p.Source -notlike "*WindowsApps*") { return $p.Source }
    Write-Host "Installing $id ..."
    winget install --id $id -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Host "=== SUMAYA Care 360 native runner ===" -ForegroundColor Cyan

# Tooling
$pyExe = Ensure-Winget "Python.Python.3.12" "python"
Ensure-Winget "OpenJS.NodeJS.LTS" "node"

# Refresh PATH for current session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python -or $python -like "*WindowsApps*") {
    $python = "$env:LocalAppData\Programs\Python\Python312\python.exe"
}
if (-not (Test-Path $python)) { throw "Python not found after install. Reopen terminal and retry." }

# Python venv + deps
if (-not (Test-Path $Venv)) {
    & $python -m venv $Venv
}
$pip = Join-Path $Venv "Scripts\pip.exe"
$py = Join-Path $Venv "Scripts\python.exe"
& $pip install -q -r (Join-Path $Backend "requirements.txt")

# SQLite DB for zero-docker local dev (no Postgres service required)
$env:DATABASE_URL = "sqlite:///./sumayacare360.db"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:JWT_SECRET = "sumaya-care-360-dev-jwt-secret-change-in-prod"
$env:CORS_ORIGINS = "http://localhost:5173,http://localhost:3000"
$env:SEED_ON_START = "true"

Push-Location $Backend
& $py -m app.db.seed
Pop-Location

if ($InstallOnly) {
    Write-Host "Install complete. Run without -InstallOnly to start servers."
    exit 0
}

Write-Host "Starting API on http://localhost:8000 ..."
$api = Start-Process -PassThru -FilePath $py -ArgumentList "-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--reload" -WorkingDirectory $Backend -WindowStyle Minimized

Push-Location $Frontend
if (-not (Test-Path "node_modules")) { npm install }
Write-Host "Starting web on http://localhost:5173 ..."
$web = Start-Process -PassThru -FilePath "npm" -ArgumentList "run","dev","--","--host" -WorkingDirectory $Frontend -WindowStyle Minimized
Pop-Location

Write-Host ""
Write-Host "RUNNING (native, no Docker)" -ForegroundColor Green
Write-Host "  Web:  http://localhost:5173"
Write-Host "  API:  http://localhost:8000/docs"
Write-Host "  Login: admin@demo.sumaya / TenantAdmin@360  tenant=demo"
Write-Host "Stop: close the API and Vite windows or end processes $($api.Id), $($web.Id)"
