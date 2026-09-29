$p = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -match 'bot.mjs --port 25565' }
if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; 'killed ' + ($p | Measure-Object).Count } else { 'none' }
