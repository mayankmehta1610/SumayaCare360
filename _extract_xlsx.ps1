$xlsx = "C:\Code\SumayaCare360\SUMAYA_Care_360_Enterprise_Requirements_Audit_Telemedicine_Expanded.xlsx"
$outDir = "C:\Code\SumayaCare360\_extract"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($xlsx)
function Get-SheetData($name) {
  $ws = $wb.Sheets.Item($name)
  $used = $ws.UsedRange
  $rows = $used.Rows.Count
  $cols = $used.Columns.Count
  $data = @()
  for ($r = 1; $r -le $rows; $r++) {
    $row = @()
    for ($c = 1; $c -le $cols; $c++) {
      $v = $ws.Cells.Item($r,$c).Text
      if ($null -eq $v) { $v = "" }
      $row += $v
    }
    $data += ,@($row)
  }
  return @{ Rows = $rows; Cols = $cols; Data = $data }
}

# Feature Backlog module counts (col D = 4), Priority col I = 9
$fb = Get-SheetData "Feature Backlog"
$hdr = $fb.Data[0]
$modIdx = 3; $priIdx = 8; $featIdx = 5
$moduleCounts = @{}
$mustByModule = @{}
for ($i = 1; $i -lt $fb.Data.Count; $i++) {
  $row = $fb.Data[$i]
  $mod = $row[$modIdx].Trim()
  if (-not $mod) { continue }
  if (-not $moduleCounts.ContainsKey($mod)) { $moduleCounts[$mod] = 0; $mustByModule[$mod] = 0 }
  $moduleCounts[$mod]++
  $pri = $row[$priIdx].Trim()
  if ($pri -match 'Must') { $mustByModule[$mod]++ }
}
$moduleCounts.GetEnumerator() | Sort-Object Value -Descending | ConvertTo-Json -Depth 3 | Set-Content "$outDir\feature_module_counts.json" -Encoding UTF8
$mustByModule.GetEnumerator() | Sort-Object Value -Descending | ConvertTo-Json -Depth 3 | Set-Content "$outDir\feature_must_by_module.json" -Encoding UTF8

# Reports - all report names (find Report column)
$rep = Get-SheetData "Reports & Analytics"
$repHdr = $rep.Data[0]
$repNames = @()
for ($i = 1; $i -lt $rep.Data.Count; $i++) {
  $row = $rep.Data[$i]
  # try columns with Report in header
  for ($c = 0; $c -lt $repHdr.Count; $c++) {
    if ($repHdr[$c] -match 'Report') { if ($row[$c]) { $repNames += $row[$c].Trim() } }
  }
}
$repNames | Sort-Object -Unique | Set-Content "$outDir\report_names.txt" -Encoding UTF8

# API Backlog - services and endpoints
$api = Get-SheetData "API Backlog"
$apiHdr = $api.Data[0]
$apiRows = @()
for ($i = 1; $i -lt $api.Data.Count; $i++) {
  $apiRows += [pscustomobject]@{ Row = $api.Data[$i]; Hdr = $apiHdr }
}
$apiHdr -join '|' | Set-Content "$outDir\api_hdr.txt" -Encoding UTF8
$api.Data | ForEach-Object { $_ -join '|' } | Set-Content "$outDir\api_backlog.tsv" -Encoding UTF8

# Expanded API first 100 data rows
$eapi = Get-SheetData "Expanded API Backlog"
$eapi.Data[0..([Math]::Min(100, $eapi.Data.Count-1))] | ForEach-Object { $_ -join '|' } | Set-Content "$outDir\expanded_api_100.tsv" -Encoding UTF8
$eapiHdr = $eapi.Data[0] -join '|'
$eapiHdr | Set-Content "$outDir\expanded_api_hdr.txt" -Encoding UTF8

# Workflows first 80 rows
$wf = Get-SheetData "Workflows"
$wf.Data[0..([Math]::Min(80, $wf.Data.Count-1))] | ForEach-Object { $_ -join '|' } | Set-Content "$outDir\workflows_80.tsv" -Encoding UTF8
$wf.Data[0] -join '|' | Set-Content "$outDir\workflows_hdr.txt" -Encoding UTF8

# Full sheets for Compliance, Roles, Masters
@('Compliance','Roles & Access','Masters','Expanded Masters') | ForEach-Object {
  $s = Get-SheetData $_
  $s.Data | ForEach-Object { $_ -join '|' } | Set-Content "$outDir\$($_ -replace '[^a-zA-Z0-9]','_').tsv" -Encoding UTF8
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
[GC]::Collect()
"Done. FB rows: $($fb.Data.Count-1) modules: $($moduleCounts.Count)"
