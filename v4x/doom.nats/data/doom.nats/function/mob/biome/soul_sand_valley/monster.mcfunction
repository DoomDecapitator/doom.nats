# doom.nats:mob/biome/soul_sand_valley/monster —— minecraft:soul_sand_valley · monster（权重和 71，3 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_fortress run return run function doom.nats:mob/fortress
execute if predicate doom.nats:spawn/in_pillager_outpost run return run function doom.nats:mob/struct/pillager_outpost_monster
execute if predicate doom.nats:spawn/in_swamp_hut run return run function doom.nats:mob/struct/swamp_hut_monster
execute if predicate doom.nats:spawn/in_monument run return run function doom.nats:mob/struct/monument_monster
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 71
scoreboard players operation #off doom.nats = #wsum doom.nats
execute if data storage doom.nats:author entries[0] run function doom.nats:author/entry_scan_monster
# 实验性条目（storage doom.nats:exp → entries[]）：总开关 enabled=1b 时才进池
scoreboard players set $exp.on doom.nats 0
execute if data storage doom.nats:exp enabled run execute store result score $exp.on doom.nats run data get storage doom.nats:exp enabled
execute if score $exp.on doom.nats matches 1 if data storage doom.nats:exp entries[0] run function doom.nats:exp/entry_scan_monster
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..19 run data merge storage doom.nats:sel {type:"minecraft:skeleton",slug:"skeleton",cat:"monster",min:5,max:5}
execute if score $rng doom.nats matches 0..19 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.monster"]}
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.rule doom.nats 5
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0..19 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 0..19 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 0..19 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 20..69 run data merge storage doom.nats:sel {type:"minecraft:ghast",slug:"ghast",cat:"monster",min:4,max:4}
execute if score $rng doom.nats matches 20..69 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.monster"]}
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.rule doom.nats 15
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.wide doom.nats 1
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.wide2 doom.nats 1
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.tall doom.nats 1
execute if score $rng doom.nats matches 20..69 run scoreboard players set $sel.cluster doom.nats 1
execute if score $rng doom.nats matches 20..69 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 20..69 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 70 run data merge storage doom.nats:sel {type:"minecraft:enderman",slug:"enderman",cat:"monster",min:4,max:4}
execute if score $rng doom.nats matches 70 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.monster"]}
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.rule doom.nats 12
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.tall doom.nats 1
execute if score $rng doom.nats matches 70 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 70 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 70 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
