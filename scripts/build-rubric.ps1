param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [string]$OutFile
)

$ErrorActionPreference = 'Stop'
$rootPath = (Resolve-Path $Root).Path
$configPath = Join-Path $PSScriptRoot 'rubric-config.json'
$csvPath = Join-Path $rootPath 'RUBRIC_SELF_ASSESSMENT.csv'
if (-not $OutFile) { $OutFile = Join-Path $rootPath 'Rubric.xlsx' }

$config = [IO.File]::ReadAllText($configPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$csvText = [IO.File]::ReadAllText($csvPath, [Text.Encoding]::UTF8)
$data = @($csvText | ConvertFrom-Csv -Header c1, c2, c3, c4, c5, c6, c7 | Select-Object -Skip 1)
if ($data.Count -ne 32) { throw "Expected 32 rubric rows, found $($data.Count)." }

# Write the whole block in one COM call per range. Calling Value2 cell by cell
# after a text cell makes Excel's late binder fail with InvalidCastException.
$invariant = [Globalization.CultureInfo]::InvariantCulture
$headers = @($config.headers)
$rows = $data.Count
$headerRow = 5
$firstData = 6
$lastData = $firstData + $rows - 1
$totalRow = $lastData + 1
$noteRow = $totalRow + 2

$cells = New-Object 'object[,]' $rows, 7
$totalPoints = 0.0
for ($i = 0; $i -lt $rows; $i++) {
  $row = $data[$i]
  $max = [double]::Parse([string]$row.c3, $invariant)
  $score = [double]::Parse([string]$row.c5, $invariant)
  $totalPoints += $score
  $cells[$i, 0] = [int]$row.c1
  $cells[$i, 1] = [string]$row.c2
  $cells[$i, 2] = $max
  $cells[$i, 3] = [string]$row.c4
  $cells[$i, 4] = $score
  $cells[$i, 5] = [string]$row.c6
  $cells[$i, 6] = [string]$row.c7
}

$infoRows = New-Object 'object[,]' ($config.info.Count), 2
for ($i = 0; $i -lt $config.info.Count; $i++) {
  $infoRows[$i, 0] = [string]$config.info[$i][0]
  $infoRows[$i, 1] = [string]$config.info[$i][1]
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

try {
  $wb = $excel.Workbooks.Add()
  $ws = $wb.Worksheets.Item(1)
  $ws.Name = 'Rubric'
  $ws.Cells.Font.Name = 'Calibri'
  $ws.Cells.Font.Size = 10

  $ws.Range("A1:G1").Merge()
  $ws.Range("A1").Value2 = [string]$config.title
  $ws.Range("A1:G1").Font.Size = 14
  $ws.Range("A1:G1").Font.Bold = $true
  $ws.Range("A1:G1").HorizontalAlignment = -4108
  $ws.Rows.Item(1).RowHeight = 30

  $ws.Range("A2:G2").Merge()
  $ws.Range("A2").Value2 = [string]$config.subtitle
  $ws.Range("A2:G2").Font.Size = 10
  $ws.Range("A2:G2").Font.Italic = $true
  $ws.Range("A2:G2").HorizontalAlignment = -4108

  $ws.Range("A3:C3").Merge()
  $ws.Range("A3").Value2 = [string]$config.member1
  $ws.Range("D3:G3").Merge()
  $ws.Range("D3").Value2 = [string]$config.member2
  $ws.Range("A4:C4").Merge()
  $ws.Range("A4").Value2 = [string]$config.updated
  $ws.Range("D4:G4").Merge()
  $ws.Range("D4").Value2 = ('{0}: {1:0.00}/10.00' -f [string]$config.totalLabel, $totalPoints)
  $ws.Range("A3:G4").Font.Size = 10
  $ws.Rows.Item(3).RowHeight = 18
  $ws.Rows.Item(4).RowHeight = 18

  $ws.Range("A${headerRow}:G${headerRow}").Value2 = $headers
  $headerRange = $ws.Range("A${headerRow}:G${headerRow}")
  $headerRange.Font.Bold = $true
  $headerRange.Font.Color = 16777215
  $headerRange.Interior.Color = 8404992
  $headerRange.HorizontalAlignment = -4108
  $headerRange.VerticalAlignment = -4108
  $ws.Rows.Item($headerRow).RowHeight = 24

  $ws.Range("A${firstData}:G${lastData}").Value2 = $cells
  $dataRange = $ws.Range("A${firstData}:G${lastData}")
  $dataRange.Borders.LineStyle = 1
  $dataRange.Borders.Weight = 2
  $dataRange.WrapText = $true

  $ws.Range("C${firstData}:C${lastData}").NumberFormat = '0.00'
  $ws.Range("E${firstData}:E${lastData}").NumberFormat = '0.00'
  $ws.Range("A${firstData}:A${lastData}").HorizontalAlignment = -4108
  $ws.Range("C${firstData}:C${lastData}").HorizontalAlignment = -4108
  $ws.Range("E${firstData}:E${lastData}").HorizontalAlignment = -4108
  $ws.Range("B${firstData}:B${lastData}").VerticalAlignment = -4160
  $ws.Range("F${firstData}:G${lastData}").VerticalAlignment = -4160

  for ($i = 1; $i -lt $rows; $i += 2) {
    $r = $firstData + $i
    $ws.Range("A${r}:G${r}").Interior.Color = 16316664
  }

  $ws.Range("A${totalRow}:D${totalRow}").Merge()
  $ws.Range("A${totalRow}").Value2 = [string]$config.total
  $ws.Range("E${totalRow}").Formula = "=SUM(E${firstData}:E${lastData})"
  $ws.Range("E${totalRow}").NumberFormat = '0.00'
  $totalRange = $ws.Range("A${totalRow}:G${totalRow}")
  $totalRange.Font.Bold = $true
  $totalRange.Interior.Color = 14803425
  $totalRange.Borders.LineStyle = 1
  $totalRange.Borders.Weight = 2
  $ws.Range("A${totalRow}").HorizontalAlignment = -4108
  $ws.Range("E${totalRow}").HorizontalAlignment = -4108

  $ws.Range("A${noteRow}:G${noteRow}").Merge()
  $ws.Range("A${noteRow}").Value2 = [string]$config.note
  $ws.Range("A${noteRow}:G${noteRow}").Font.Italic = $true
  $ws.Range("A${noteRow}:G${noteRow}").Font.Size = 9
  $ws.Range("A${noteRow}:G${noteRow}").WrapText = $true
  $ws.Rows.Item($noteRow).RowHeight = 34

  $widths = @(6, 34, 11, 24, 11, 52, 52)
  for ($col = 1; $col -le 7; $col++) { $ws.Columns.Item($col).ColumnWidth = $widths[$col - 1] }

  # Let wrapped text grow the rows instead of clipping it.
  $ws.Rows.Item("${firstData}:${lastData}").AutoFit()
  $ws.Rows.Item($headerRow).AutoFit()

  $ws.PageSetup.Orientation = 2
  $ws.PageSetup.Zoom = $false
  $ws.PageSetup.FitToPagesWide = 1
  $ws.PageSetup.FitToPagesTall = $false
  $ws.PageSetup.PrintTitleRows = "`$${headerRow}:`$${headerRow}"

  $info = $wb.Worksheets.Add([System.Reflection.Missing]::Value, $ws)
  $info.Name = [string]$config.infoSheet
  $info.Cells.Font.Name = 'Calibri'
  $info.Cells.Font.Size = 10
  $info.Range("A1:B1").Merge()
  $info.Range("A1").Value2 = 'THONG TIN CHAM BAI'
  $info.Range("A1:B1").Font.Bold = $true
  $info.Range("A1:B1").Font.Size = 14
  $info.Rows.Item(1).RowHeight = 26
  $info.Range("A3:B$($config.info.Count + 2)").Value2 = $infoRows
  $info.Range("A3:B$($config.info.Count + 2)").WrapText = $true
  $info.Range("A3:B$($config.info.Count + 2)").Borders.LineStyle = 1
  $info.Range("A3:B$($config.info.Count + 2)").Borders.Weight = 2
  $info.Range("A3:A$($config.info.Count + 2)").Font.Bold = $true
  $info.Range("A3:B$($config.info.Count + 2)").VerticalAlignment = -4160
  for ($r = 3; $r -le ($config.info.Count + 2); $r++) { $info.Rows.Item($r).RowHeight = 30 }
  $info.Columns.Item(1).ColumnWidth = 24
  $info.Columns.Item(2).ColumnWidth = 96
  $info.PageSetup.Orientation = 2

  $ws.Activate()
  $wb.SaveAs($OutFile, 51)
  $wb.Close($false)
  Write-Output ("Saved {0} with {1} rows, total {2:0.00}" -f $OutFile, $rows, $totalPoints)
}
finally {
  $excel.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
