# Run as Administrator: right-click PowerShell -> Run as administrator
#   cd C:\Code\SumayaCare360
#   .\scripts\enable-docker-prereqs.ps1

$ErrorActionPreference = "Stop"

function Require-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host "Re-launching elevated..."
        Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
        exit
    }
}

Require-Admin

Write-Host "=== SUMAYA Care 360 - Docker prerequisites ===" -ForegroundColor Cyan

Write-Host "`n[1/5] CPU / firmware virtualization check"
$virt = (Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled
if ($virt) {
    Write-Host "  OK: Virtualization enabled in firmware" -ForegroundColor Green
} else {
    Write-Host "  BLOCKER: Virtualization is DISABLED in BIOS/UEFI" -ForegroundColor Red
    Write-Host "  HP 245 G7 (AMD): reboot -> press F10 -> Advanced -> System Options"
    Write-Host "  Enable: SVM Mode / AMD-V / Virtualization Technology -> Save & Exit"
    Write-Host "  Then run this script again."
}

Write-Host "`n[2/5] Enable Windows optional features"
$features = @(
    "VirtualMachinePlatform",
    "Microsoft-Windows-Subsystem-Linux",
    "HypervisorPlatform"
)
foreach ($f in $features) {
    $state = (Get-WindowsOptionalFeature -Online -FeatureName $f).State
    if ($state -ne "Enabled") {
        Write-Host "  Enabling $f ..."
        Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart | Out-Null
    } else {
        Write-Host "  $f already enabled"
    }
}

Write-Host "`n[3/5] Hypervisor boot setting"
$launch = (bcdedit /enum `{current`} | Select-String "hypervisorlaunchtype").ToString()
Write-Host "  Current: $launch"
if ($launch -notmatch "auto") {
    bcdedit /set hypervisorlaunchtype auto | Out-Null
    Write-Host "  Set hypervisorlaunchtype = auto" -ForegroundColor Green
}

Write-Host "`n[4/5] Install WSL + Ubuntu (if missing)"
wsl --install -d Ubuntu --no-launch 2>&1 | ForEach-Object { Write-Host "  $_" }

Write-Host "`n[5/5] Update WSL kernel"
wsl --update 2>&1 | ForEach-Object { Write-Host "  $_" }

Write-Host "`n=== Done ===" -ForegroundColor Cyan
if (-not $virt) {
    Write-Host "REBOOT -> enable SVM in BIOS (F10) -> reboot again -> start Docker Desktop"
} else {
    Write-Host "REBOOT recommended, then start Docker Desktop and run:"
    Write-Host "  cd C:\Code\SumayaCare360"
    Write-Host "  docker compose up --build -d"
}
