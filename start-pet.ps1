$ErrorActionPreference = 'Stop'
$petRoot = $PSScriptRoot
try {
  $petElectron = Join-Path $petRoot 'node_modules\electron\dist\electron.exe'
  if (-not (Test-Path -LiteralPath $petElectron)) {
    throw 'Electron is missing. Run npm ci and node node_modules/electron/install.js in the app folder first.'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $petRoot 'dist\index.html'))) {
    throw 'The app build is missing. Run npm run build in the app folder first.'
  }
  Start-Process -FilePath $petElectron -ArgumentList ('"' + $petRoot + '"') -WorkingDirectory $petRoot -WindowStyle Hidden
} catch {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, '鼓足气 · puffo-pump!', 'OK', 'Error') | Out-Null
  exit 1
}
