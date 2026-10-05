# doom.nats:debug/reject [MACRO] —— 生成失败归因（供 [nats.reject] 直方图）
#
# reason 编码（对齐 docs/11 的合法性链）：
#   0=抽不到合格区块 · 1=24 格内有玩家 · 2=出 128 格 · 3=光照 · 4=落位方块 · 5=容量已满 · 10=世界出生点 24 格内
$scoreboard players add $rej.$(reason) doom.nats 1
$execute if score $rej_log doom.nats matches 1 run tellraw @a [{"text":"[nats.reject] ","color":"dark_gray"},{"text":"reason=$(reason)","color":"red"}]
