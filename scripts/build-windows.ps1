[CmdletBinding()]
param(
  [string]$ReleaseVersion = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($ReleaseVersion -ne "") {
  $env:RELEASE_VERSION = $ReleaseVersion
}

pnpm exec node scripts/build-windows.mjs
if ($LASTEXITCODE -ne 0) {
  throw "PipeFlow Windows build failed with exit code $LASTEXITCODE"
}

Write-Host "Build completed. Inspect dist\ for NSIS and Portable EXE artifacts."
