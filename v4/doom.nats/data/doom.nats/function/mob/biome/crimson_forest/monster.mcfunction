# doom.nats:mob/biome/crimson_forest/monster —— minecraft:crimson_forest · monster（权重和 15，3 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_fortress run return run function doom.nats:mob/fortress
execute if predicate doom.nats:spawn/in_pillager_outpost run return run function doom.nats:mob/struct/pillager_outpost_monster
execute if predicate doom.nats:spawn/in_swamp_hut run return run function doom.nats:mob/struct/swamp_hut_monster
execute if predicate doom.nats:spawn/in_monument run return run function doom.nats:mob/struct/monument_monster
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 15
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0 run data merge storage doom.nats:sel {type:"minecraft:zombified_piglin",slug:"zombified_piglin",cat:"monster",min:2,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.rule doom.nats 25
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 1..9 run data merge storage doom.nats:sel {type:"minecraft:hoglin",slug:"hoglin",cat:"monster",min:3,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.rule doom.nats 19
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.wide doom.nats 1
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 1..9 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 10..14 run data merge storage doom.nats:sel {type:"minecraft:piglin",slug:"piglin",cat:"monster",min:3,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.rule doom.nats 25
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.cluster doom.nats 4
