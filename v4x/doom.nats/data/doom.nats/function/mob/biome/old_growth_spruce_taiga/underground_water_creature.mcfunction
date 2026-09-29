# doom.nats:mob/biome/old_growth_spruce_taiga/underground_water_creature —— minecraft:old_growth_spruce_taiga · underground_water_creature（权重和 10，1 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_monument run return 0
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 10
scoreboard players operation #off doom.nats = #wsum doom.nats
execute if data storage doom.nats:author entries[0] run function doom.nats:author/entry_scan_underground_water_creature
# 实验性条目（storage doom.nats:exp → entries[]）：总开关 enabled=1b 时才进池
scoreboard players set $exp.on doom.nats 0
execute if data storage doom.nats:exp enabled run execute store result score $exp.on doom.nats run data get storage doom.nats:exp enabled
execute if score $exp.on doom.nats matches 1 if data storage doom.nats:exp entries[0] run function doom.nats:exp/entry_scan_underground_water_creature
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..9 run data merge storage doom.nats:sel {type:"minecraft:glow_squid",slug:"glow_squid",cat:"underground_water_creature",min:4,max:6}
execute if score $rng doom.nats matches 0..9 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.underground_water_creature"]}
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.rule doom.nats 16
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.place doom.nats 2
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.light doom.nats 5
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 0..9 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 0..9 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
