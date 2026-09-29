# doom.nats:mob/biome/windswept_savanna/creature —— minecraft:windswept_savanna · creature（权重和 52，7 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_swamp_hut run return run function doom.nats:mob/struct/swamp_hut_creature
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 52
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..11 run data merge storage doom.nats:sel {type:"minecraft:sheep",slug:"sheep",cat:"creature",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0..11 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 12..21 run data merge storage doom.nats:sel {type:"minecraft:pig",slug:"pig",cat:"creature",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 12..21 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 22..31 run data merge storage doom.nats:sel {type:"minecraft:chicken",slug:"chicken",cat:"creature",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 22..31 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 32..39 run data merge storage doom.nats:sel {type:"minecraft:cow",slug:"cow",cat:"creature",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 32..39 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 40 run data merge storage doom.nats:sel {type:"minecraft:horse",slug:"horse",cat:"creature",min:2,max:6,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.rule doom.nats 10
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.wide doom.nats 1
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 40 run scoreboard players set $sel.cluster doom.nats 6
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 41 run data merge storage doom.nats:sel {type:"minecraft:donkey",slug:"donkey",cat:"creature",min:1,max:1,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.rule doom.nats 10
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.wide doom.nats 1
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 41 run scoreboard players set $sel.cluster doom.nats 6
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 42..51 run data merge storage doom.nats:sel {type:"minecraft:armadillo",slug:"armadillo",cat:"creature",min:2,max:3,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.rule doom.nats 1
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.tag doom.nats 7
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 42..51 run scoreboard players set $sel.cluster doom.nats 4
