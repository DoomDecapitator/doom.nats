# doom.nats:mob/biome/frozen_ocean/creature —— minecraft:frozen_ocean · creature（权重和 1，1 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_swamp_hut run return run function doom.nats:mob/struct/swamp_hut_creature
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 1
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0 run data merge storage doom.nats:sel {type:"minecraft:polar_bear",slug:"polar_bear",cat:"creature",min:1,max:2,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.rule doom.nats 26
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.wide doom.nats 1
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.cluster doom.nats 4
