# doom.nats:mob/biome/old_growth_pine_taiga/creature —— minecraft:old_growth_pine_taiga · creature（权重和 60，7 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_swamp_hut run return run function doom.nats:mob/struct/swamp_hut_creature
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 60
scoreboard players operation #off doom.nats = #wsum doom.nats
execute if data storage doom.nats:author entries[0] run function doom.nats:author/entry_scan_creature
# 实验性条目（storage doom.nats:exp → entries[]）：总开关 enabled=1b 时才进池
scoreboard players set $exp.on doom.nats 0
execute if data storage doom.nats:exp enabled run execute store result score $exp.on doom.nats run data get storage doom.nats:exp enabled
execute if score $exp.on doom.nats matches 1 if data storage doom.nats:exp entries[0] run function doom.nats:exp/entry_scan_creature
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..11 run data merge storage doom.nats:sel {type:"minecraft:sheep",slug:"sheep",cat:"creature",min:4,max:4}
execute if score $rng doom.nats matches 0..11 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.creature"]}
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 0..11 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 0..11 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 12..21 run data merge storage doom.nats:sel {type:"minecraft:pig",slug:"pig",cat:"creature",min:4,max:4}
execute if score $rng doom.nats matches 12..21 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.creature"]}
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 12..21 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 12..21 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 22..31 run data merge storage doom.nats:sel {type:"minecraft:chicken",slug:"chicken",cat:"creature",min:4,max:4}
execute if score $rng doom.nats matches 22..31 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.creature"]}
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 22..31 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 22..31 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 32..39 run data merge storage doom.nats:sel {type:"minecraft:cow",slug:"cow",cat:"creature",min:4,max:4}
execute if score $rng doom.nats matches 32..39 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.creature"]}
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 32..39 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 32..39 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 40..47 run data merge storage doom.nats:sel {type:"minecraft:wolf",slug:"wolf",cat:"creature",min:4,max:4}
execute if score $rng doom.nats matches 40..47 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.creature"]}
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.rule doom.nats 33
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.tag doom.nats 4
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 40..47 run scoreboard players set $sel.cluster doom.nats 8
execute if score $rng doom.nats matches 40..47 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 40..47 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 48..51 run data merge storage doom.nats:sel {type:"minecraft:rabbit",slug:"rabbit",cat:"creature",min:2,max:3}
execute if score $rng doom.nats matches 48..51 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.creature"]}
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.rule doom.nats 27
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.tag doom.nats 3
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 48..51 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 48..51 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 48..51 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 52..59 run data merge storage doom.nats:sel {type:"minecraft:fox",slug:"fox",cat:"creature",min:2,max:4}
execute if score $rng doom.nats matches 52..59 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.creature"]}
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.rule doom.nats 13
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.tag doom.nats 2
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 52..59 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 52..59 run function doom.nats:author/row with storage doom.nats:sel
execute if score $rng doom.nats matches 52..59 if score $exp.on doom.nats matches 1 run function doom.nats:exp/row with storage doom.nats:sel
