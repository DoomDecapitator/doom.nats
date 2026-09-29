# doom.nats:mob/biome/lush_caves/axolotls —— minecraft:lush_caves · axolotls（权重和 10，1 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_monument run return 0
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 10
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..9 run data merge storage doom.nats:sel {type:"minecraft:axolotl",slug:"axolotl",cat:"axolotls",min:4,max:6,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.axolotls"]}}
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.rule doom.nats 2
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.tag doom.nats 11
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.cluster doom.nats 4
