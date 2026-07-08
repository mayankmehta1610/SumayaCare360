# Deploy SUMAYA Care 360 to Render via Blueprint API.
# Requires: RENDER_API_KEY env var (from https://dashboard.render.com/u/settings#api-keys)
param(
  [string]$ApiKey = $env:RENDER_API_KEY,
  [string]$Repo = "https://github.com/mayankmehta1610/SumayaCare360",
  [string]$Branch = "main",
  [string]$BlueprintName = "sumayacare360"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

if (-not $ApiKey) {
  throw "Set RENDER_API_KEY before running this script."
}

Write-Host "Validating render.yaml..."
$yamlPath = Join-Path $root "render.yaml"
$validateUri = "https://api.render.com/v1/blueprints/validate"
$boundary = [System.Guid]::NewGuid().ToString()
$yamlBytes = [System.IO.File]::ReadAllBytes($yamlPath)
$bodyLines = @(
  "--$boundary",
  'Content-Disposition: form-data; name="file"; filename="render.yaml"',
  "Content-Type: application/x-yaml",
  "",
  [System.Text.Encoding]::UTF8.GetString($yamlBytes),
  "--$boundary--",
  ""
)
$validateBody = ($bodyLines -join "`r`n")
$validate = Invoke-RestMethod -Uri $validateUri -Method Post -Headers @{
  Authorization = "Bearer $ApiKey"
  "Content-Type" = "multipart/form-data; boundary=$boundary"
} -Body $validateBody

if (-not $validate.valid) {
  throw "Blueprint validation failed: $($validate | ConvertTo-Json -Depth 6)"
}
Write-Host "Blueprint is valid."

Write-Host "Creating Render blueprint..."
$createBody = @{
  name = $BlueprintName
  repo = $Repo
  branch = $Branch
  autoDeploy = "yes"
} | ConvertTo-Json

$blueprint = Invoke-RestMethod -Uri "https://api.render.com/v1/blueprints" -Method Post -Headers @{
  Authorization = "Bearer $ApiKey"
  "Content-Type" = "application/json"
} -Body $createBody

Write-Host "Blueprint created."
Write-Host "Dashboard: https://dashboard.render.com/"
$blueprint | ConvertTo-Json -Depth 6
