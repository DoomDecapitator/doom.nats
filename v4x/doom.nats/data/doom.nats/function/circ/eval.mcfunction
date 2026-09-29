# doom.nats:circ/eval —— 判定所有情形（由 tools/gen_ctm.mjs 从 CIRC 表展开，勿手改）
#
# 依赖 doom.nats:circ/snapshot 产出的快照分数：$snap.weather / daytime / dim / players / phase

# rainy_night：雨夜：节拍加快、怪物上限提高
scoreboard players set $circ.rainy_night doom.nats 0
execute if score $snap.weather doom.nats matches 1.. if score $snap.daytime doom.nats matches 13000..23000 run scoreboard players set $circ.rainy_night doom.nats 1

# thunder：雷暴：原版靠 skyDarken=10 让刷怪更容易（Monster.isDarkEnoughToSpawn），这里显式化
scoreboard players set $circ.thunder doom.nats 0
execute if score $snap.weather doom.nats matches 2.. run scoreboard players set $circ.thunder doom.nats 1

# multiplayer：多人：per-player cap 各自独立、并集容量随人数放大，故放宽全局节拍
scoreboard players set $circ.multiplayer doom.nats 0
execute if score $snap.players doom.nats matches 2.. run scoreboard players set $circ.multiplayer doom.nats 1

# nether：下界：block_light_limit=15（不限制方块光）、综合亮度 <= 7（对齐 dimension_type）
scoreboard players set $circ.nether doom.nats 0
execute if score $snap.dim doom.nats matches 1 run scoreboard players set $circ.nether doom.nats 1
