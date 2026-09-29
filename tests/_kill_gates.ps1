$p = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -match 'gate_merge' }
"before=" + ($p | Measure-Object).Count
$p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 3
$q = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -match 'gate_merge' }
"after_kill=" + ($q | Measure-Object).Count
