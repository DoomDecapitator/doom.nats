param([string]$Cmd, [string]$Log, [string]$WorkDir)
$full = 'cmd.exe /c "' + $Cmd + ' >> ' + $Log + ' 2>&1"'
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $full; CurrentDirectory = $WorkDir }
'pid=' + $r.ProcessId + ' rc=' + $r.ReturnValue
