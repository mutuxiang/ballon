$ErrorActionPreference = 'Stop'
$previewRoot = $PSScriptRoot
$previewUrl = 'http://127.0.0.1:5190/play.html'
function Test-GamePreview {
  try { return (Invoke-RestMethod -Uri 'http://127.0.0.1:5190/health' -TimeoutSec 2).app -eq 'air-worker-play' }
  catch { return $false }
}
try {
  if (-not (Test-GamePreview)) {
    $runtimeCommand = Get-Command node -ErrorAction SilentlyContinue
    $previewNode = if ($runtimeCommand) { $runtimeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
    if (-not (Test-Path -LiteralPath $previewNode)) { throw 'Node.js is required. Install Node.js, then run this launcher again.' }
    $previewProcess = Start-Process -FilePath $previewNode -ArgumentList @('play-preview.cjs') -WorkingDirectory $previewRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $previewRoot 'play-preview.log') -RedirectStandardError (Join-Path $previewRoot 'play-preview-error.log') -PassThru
    $previewReady = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      if (Test-GamePreview) { $previewReady = $true; break }
      if ($previewProcess.HasExited) { break }
      Start-Sleep -Milliseconds 200
    }
    if (-not $previewReady) { throw 'Preview failed to start. See play-preview-error.log; port 5190 may be occupied.' }
  }
  Start-Process $previewUrl
  Write-Output "Ready: $previewUrl"
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
