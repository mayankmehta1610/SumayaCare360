# Smoke checks once Docker is up
param(
  [string]$ApiBase = "http://localhost:8000/api/v1"
)

$ErrorActionPreference = "Stop"

Write-Host "1) Health..."
$h = Invoke-RestMethod "$ApiBase/health"
Write-Host "   $($h.status)"

Write-Host "2) Login demo tenant..."
$login = Invoke-RestMethod "$ApiBase/auth/login" -Method POST -ContentType "application/json" -Body (@{
  email = "admin@demo.sumaya"; password = "TenantAdmin@360"; tenant_code = "demo"
} | ConvertTo-Json)
$token = $login.access_token
$headers = @{
  Authorization = "Bearer $token"
  "X-Tenant-Code" = "demo"
  "Content-Type" = "application/json"
}

Write-Host "3) Masters genders/tariffs..."
$genders = Invoke-RestMethod "$ApiBase/masters/genders" -Headers $headers
$tariffs = Invoke-RestMethod "$ApiBase/masters/tariffs" -Headers $headers
if ($genders.Count -lt 1) { throw "genders master empty" }
if ($tariffs.Count -lt 1) { throw "tariffs master empty" }

Write-Host "4) Create patient..."
$patient = Invoke-RestMethod "$ApiBase/patients" -Method POST -Headers $headers -Body (@{
  first_name = "Smoke"; last_name = "Test"; phone = "9999999999"; gender_code = "M"
} | ConvertTo-Json)

$providers = Invoke-RestMethod "$ApiBase/providers" -Headers $headers
$providerId = $providers[0].id

Write-Host "5) Book appointment..."
$appt = Invoke-RestMethod "$ApiBase/appointments" -Method POST -Headers $headers -Body (@{
  patient_id = $patient.id
  provider_id = $providerId
  scheduled_at = (Get-Date).AddHours(2).ToUniversalTime().ToString("o")
  mode = "telemedicine"
  reason = "Smoke test"
} | ConvertTo-Json)

Write-Host "6) Encounter + note..."
$enc = Invoke-RestMethod "$ApiBase/encounters" -Method POST -Headers $headers -Body (@{
  patient_id = $patient.id; provider_id = $providerId; appointment_id = $appt.id; chief_complaint = "Cough"
} | ConvertTo-Json)
Invoke-RestMethod "$ApiBase/encounters/$($enc.id)/notes" -Method POST -Headers $headers -Body (@{
  content = "Patient stable"; note_type = "progress"; template_code = "SOAP"
} | ConvertTo-Json) | Out-Null

Write-Host "7) Invoice + payment..."
$inv = Invoke-RestMethod "$ApiBase/billing/invoices" -Method POST -Headers $headers -Body (@{
  patient_id = $patient.id; lines = @(@{ tariff_code = "OPD_CONSULT"; qty = 1 })
} | ConvertTo-Json -Depth 5)
Invoke-RestMethod "$ApiBase/billing/payments" -Method POST -Headers $headers -Body (@{
  invoice_id = $inv.id; amount = $inv.total; gateway_token_ref = "tok_smoke"; masked_last4 = "4242"
} | ConvertTo-Json) | Out-Null

Write-Host "8) Audit logs present..."
$logs = Invoke-RestMethod "$ApiBase/audit/logs" -Headers $headers
if ($logs.Count -lt 1) { throw "audit empty" }

Write-Host "SMOKE OK"
