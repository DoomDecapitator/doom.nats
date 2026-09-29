# doom.nats:mob/biome/cold_ocean/water_creature —— minecraft:cold_ocean · water_creature（权重和 3，1 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 3
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..2 run data merge storage doom.nats:sel {type:"minecraft:squid",slug:"squid",cat:"water_creature",min:1,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.water_creature"]}}
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.rule doom.nats 9
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.place doom.nats 3
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0..2 run scoreboard players set $sel.cluster doom.nats 4
