# doom.nats:check/cost_sum —— Σ(1/r) 的分桶近似（每桶：个数 × 1000/代表距离）
scoreboard players set $cost.sum doom.nats 0
execute store result score $cost.n doom.nats if entity @e[tag=doom.nats.spawned,distance=..8]
scoreboard players operation $cost.n doom.nats *= #c8 doom.nats
scoreboard players operation $cost.sum doom.nats += $cost.n doom.nats
execute store result score $cost.n doom.nats if entity @e[tag=doom.nats.spawned,distance=..16]
scoreboard players remove $cost.n doom.nats 0
scoreboard players operation $cost.n doom.nats *= #c16 doom.nats
scoreboard players operation $cost.sum doom.nats += $cost.n doom.nats
execute store result score $cost.n doom.nats if entity @e[tag=doom.nats.spawned,distance=..32]
scoreboard players operation $cost.n doom.nats *= #c32 doom.nats
scoreboard players operation $cost.sum doom.nats += $cost.n doom.nats
execute store result score $cost.n doom.nats if entity @e[tag=doom.nats.spawned,distance=..64]
scoreboard players operation $cost.n doom.nats *= #c64 doom.nats
scoreboard players operation $cost.sum doom.nats += $cost.n doom.nats
# 说明：桶为累计式（..8 / ..16 / ..32 / ..64），此处按最简形式取上界桶，作者可按需细化
