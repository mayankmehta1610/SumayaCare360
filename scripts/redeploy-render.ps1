# Trigger redeploy on existing Render services (API + static web).
# Requires: RENDER_API_KEY from https://dashboard.render.com/u/settings#api-keys
param(
  [string]$ApiKey = $env:RENDER_API_KEY,
  [string[]]$ServiceNames = @("sumayacare360-api", "sumayacare360-web")
)

$ErrorActionPreference = "Stop"

if (-not $ApiKey) {
  throw "Set RENDER_API_KEY before running this script."
}

$headers = @{
  Authorization = "Bearer $ApiKey"
  "Content-Type" = "application/json"
}

$services = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=100" -Headers $headers
$targets = $services | Where-Object { $ServiceNames -contains $_.service.name }

if (-not $targets) {
  throw "No matching Render services found. Run deploy-render.ps1 first or check service names."
}

foreach ($item in $targets) {
  $id = $item.service.id
  $name = $item.service.name
  Write-Host "Triggering deploy: $name ($id)..."
  $deploy = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$id/deploys" -Method Post -Headers $headers -Body "{}"
  Write-Host "  Deploy $($deploy.id) — status $($deploy.status)"
}

Write-Host "Done. Monitor: https://dashboard.render.com/"
