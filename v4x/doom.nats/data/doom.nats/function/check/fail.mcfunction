# doom.nats:check/fail [MACRO] —— 标记失败原因并短路
$scoreboard players set $chk.reason doom.nats $(reason)
scoreboard players set $chk.ok doom.nats 0
