param([string]$Hotkey = 'CTRL+ALT+G')
$ErrorActionPreference = 'Stop'
$petRoot = Split-Path -Parent $PSScriptRoot
$petLauncher = Join-Path $petRoot 'start-pet.ps1'
$petIcon = Join-Path $petRoot 'public\brand\app-icon.ico'
$petShell = New-Object -ComObject WScript.Shell
$petDesktop = [Environment]::GetFolderPath('DesktopDirectory')
$petPrograms = [Environment]::GetFolderPath('Programs')
$petPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
foreach ($petDestination in @($petDesktop, $petPrograms)) {
  $petLinkPath = Join-Path $petDestination '鼓足气.lnk'
  $petShortcut = $petShell.CreateShortcut($petLinkPath)
  $petShortcut.TargetPath = $petPowerShell
  $petShortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $petLauncher + '"'
  $petShortcut.WorkingDirectory = $petRoot
  $petShortcut.IconLocation = $petIcon + ',0'
  $petShortcut.Description = '鼓足气 · puffo-pump!'
  $petShortcut.WindowStyle = 7
  $petShortcut.Hotkey = if ($petDestination -eq $petDesktop) { $Hotkey } else { '' }
  $petShortcut.Save()
  Write-Output ('Created: ' + $petLinkPath)
}
Write-Output ('Desktop hotkey: ' + $Hotkey)
