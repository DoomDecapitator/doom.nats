# doom.nats:mode/survival —— 生存直用：接管原版自然生成（装载时默认执行）
gamerule doMobSpawning false
scoreboard players set $mode.manual doom.nats 0
function doom.nats:circ/snapshot
say [nats] mode/survival —— 已接管自然生成（doMobSpawning=false）
