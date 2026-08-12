[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [string]$DistPath = "dist",
  [ValidateRange(1, 10)]
  [int]$LaunchIterations = 2,
  [ValidateRange(10, 180)]
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
$Version = $Version.TrimStart("v")
if (-not $IsWindows) { throw "This validation script must run on Windows." }

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root $DistPath
$portable = Join-Path $dist "PipeFlow-Pro-$Version-x64-portable.exe"
$installer = Join-Path $dist "PipeFlow-Pro-$Version-x64.exe"
$reportDir = Join-Path $dist "benchmarks"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

foreach ($artifact in @($portable, $installer)) {
  if (-not (Test-Path $artifact)) { throw "Missing expected Windows artifact: $artifact" }
}

$measurements = @()
for ($index = 1; $index -le $LaunchIterations; $index++) {
  $resultFile = Join-Path $reportDir "portable-smoke-$index.json"
  Remove-Item -Force -ErrorAction SilentlyContinue $resultFile
  $env:PIPEFLOW_SMOKE_RESULT = $resultFile
  $stopwatch = [Diagnostics.Stopwatch]::StartNew()
  $process = Start-Process -FilePath $portable -ArgumentList "--smoke-test" -PassThru
  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Portable smoke test exceeded $TimeoutSeconds seconds on iteration $index."
  }
  $stopwatch.Stop()
  if ($process.ExitCode -ne 0) { throw "Portable smoke test failed with exit code $($process.ExitCode) on iteration $index." }
  if (-not (Test-Path $resultFile)) { throw "Portable smoke test did not write its result file on iteration $index." }
  $smoke = Get-Content -Raw $resultFile | ConvertFrom-Json
  if ($smoke.status -ne "passed") { throw "Electron smoke test reported failure: $($smoke.error)" }
  $measurements += [PSCustomObject]@{
    iteration = $index
    processDurationMs = $stopwatch.ElapsedMilliseconds
    electronDurationMs = [int64]$smoke.durationMs
    exitCode = $process.ExitCode
  }
}
Remove-Item Env:PIPEFLOW_SMOKE_RESULT -ErrorAction SilentlyContinue

$processDurations = @($measurements | ForEach-Object { $_.processDurationMs })
$electronDurations = @($measurements | ForEach-Object { $_.electronDurationMs })
$report = [PSCustomObject]@{
  schemaVersion = "1.0"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  version = $Version
  os = [System.Environment]::OSVersion.VersionString
  portable = [PSCustomObject]@{
    path = (Resolve-Path $portable).Path
    bytes = (Get-Item $portable).Length
    sha256 = (Get-FileHash $portable -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  installer = [PSCustomObject]@{
    path = (Resolve-Path $installer).Path
    bytes = (Get-Item $installer).Length
    sha256 = (Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  launchBenchmark = [PSCustomObject]@{
    iterations = $LaunchIterations
    processMedianMs = [math]::Round((($processDurations | Sort-Object)[[math]::Floor(($processDurations.Count - 1) / 2)]), 0)
    electronMedianMs = [math]::Round((($electronDurations | Sort-Object)[[math]::Floor(($electronDurations.Count - 1) / 2)]), 0)
    samples = $measurements
  }
}

$reportPath = Join-Path $reportDir "windows-executable-benchmark.json"
$report | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $reportPath
Write-Host "Windows executable smoke test and benchmark passed: $reportPath"
