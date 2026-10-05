# doom.nats:circ/scan_chunks —— 产出 $snap.chunks（对齐 spawnableChunkCount）
#
# 原版定义：各玩家所在区块的 17×17（Chebyshev 距离 8 区块）之**并集**，与 view/simulation distance 无关。
# 数据包的限制：唯一能相对执行位置判定的只有欧氏 distance，无法表达方形；也无法维护"已计区块集合"。
#   精确并集需要按绝对坐标做 dx/dz 盒式判定（289 次宏/快照 + 逐玩家），代价大，暂不实现。
# 因此提供两种近似（$chunks_mode）：
#   0（默认）只扫首个玩家 ⇒ 单人精确、多人**低估**
#   1         逐玩家累加   ⇒ 单人精确、多人**高估**（重叠重复计数）

execute unless score $chunks_mode doom.nats matches 0..1 run scoreboard players set $chunks_mode doom.nats 0
scoreboard players set $snap.chunks doom.nats 0
execute if score $chunks_mode doom.nats matches 0 at @a[gamemode=!spectator,limit=1] run function doom.nats:circ/scan_one
execute if score $chunks_mode doom.nats matches 1 as @a[gamemode=!spectator] at @s run function doom.nats:circ/scan_one
