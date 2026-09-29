# doom.nats:mob/biome/deep_lukewarm_ocean/water_ambient —— minecraft:deep_lukewarm_ocean · water_ambient（权重和 38，3 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 38
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..7 run data merge storage doom.nats:sel {type:"minecraft:cod",slug:"cod",cat:"water_ambient",min:3,max:6,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.water_ambient"]}}
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.rule doom.nats 8
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.place doom.nats 3
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0..7 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 8..12 run data merge storage doom.nats:sel {type:"minecraft:pufferfish",slug:"pufferfish",cat:"water_ambient",min:1,max:3,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.water_ambient"]}}
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.rule doom.nats 8
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.place doom.nats 3
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 8..12 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 13..37 run data merge storage doom.nats:sel {type:"minecraft:tropical_fish",slug:"tropical_fish",cat:"water_ambient",min:8,max:8,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.water_ambient"]}}
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.rule doom.nats 31
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.place doom.nats 3
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.grp1 doom.nats 1
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 13..37 run scoreboard players set $sel.cluster doom.nats 8
