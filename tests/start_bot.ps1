param([string]$Name, [int]$Minutes = 90, [int]$Port = 25565)
$dir = 'C:\Users\Dell\Downloads\datapack'
$log = Join-Path $dir ('_work\' + $Name.ToLower() + '.log')
$cmd = 'cmd.exe /c ""C:\Program Files\nodejs\node.exe" _work\mcserver\bot.mjs --port ' + $Port + ' --name ' + $Name + ' --minutes ' + $Minutes + ' >> "' + $log + '" 2>&1"'
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $dir }
'pid=' + $r.ProcessId + ' rc=' + $r.ReturnValue
