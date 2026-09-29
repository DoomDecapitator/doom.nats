# doom.nats:mob/biome/old_growth_pine_taiga/monster —— minecraft:old_growth_pine_taiga · monster（权重和 540，8 条）

# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----
execute if predicate doom.nats:spawn/in_fortress run return run function doom.nats:mob/fortress
execute if predicate doom.nats:spawn/in_pillager_outpost run return run function doom.nats:mob/struct/pillager_outpost_monster
execute if predicate doom.nats:spawn/in_swamp_hut run return run function doom.nats:mob/struct/swamp_hut_monster
execute if predicate doom.nats:spawn/in_monument run return run function doom.nats:mob/struct/monument_monster
execute if predicate doom.nats:spawn/in_ancient_city run return 0
execute if predicate doom.nats:spawn/in_trial_chambers run return 0

scoreboard players set #wsum doom.nats 540
scoreboard players operation $rng doom.nats %= #wsum doom.nats
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..99 run data merge storage doom.nats:sel {type:"minecraft:spider",slug:"spider",cat:"monster",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.rule doom.nats 29
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.wide doom.nats 1
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 0..99 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 100..199 run data merge storage doom.nats:sel {type:"minecraft:zombie",slug:"zombie",cat:"monster",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.rule doom.nats 5
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 100..199 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 200..224 run data merge storage doom.nats:sel {type:"minecraft:zombie_villager",slug:"zombie_villager",cat:"monster",min:1,max:1,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.rule doom.nats 5
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 200..224 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 225..324 run data merge storage doom.nats:sel {type:"minecraft:skeleton",slug:"skeleton",cat:"monster",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.rule doom.nats 5
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 225..324 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 325..424 run data merge storage doom.nats:sel {type:"minecraft:creeper",slug:"creeper",cat:"monster",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.rule doom.nats 5
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 325..424 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 425..524 run data merge storage doom.nats:sel {type:"minecraft:slime",slug:"slime",cat:"monster",min:4,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.rule doom.nats 28
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.light doom.nats 4
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 425..524 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 525..534 run data merge storage doom.nats:sel {type:"minecraft:enderman",slug:"enderman",cat:"monster",min:1,max:4,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.rule doom.nats 12
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.tall doom.nats 1
execute if score $rng doom.nats matches 525..534 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 535..539 run data merge storage doom.nats:sel {type:"minecraft:witch",slug:"witch",cat:"monster",min:1,max:1,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster"]}}
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.rule doom.nats 5
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 535..539 run scoreboard players set $sel.cluster doom.nats 4
