# doom.nats:mob/struct/swamp_hut_creature —— swamp_hut.spawn_overrides[creature]（权重和 1）
# 数据：vanilla data/minecraft/worldgen/structure/swamp_hut.json 的 spawn_overrides，逐字抄（type/minCount/maxCount/weight）
# 调用点：doom.nats:mob/biome/<群系>/creature 的**前置结构检查**（命中即整表替换群系表）。
# ⚠ 不改 $cost.threshold：原版 spawn cost 取的是**群系**的 MobSpawnSettings.getMobSpawnCost，与结构覆盖无关。

scoreboard players set #wsum doom.nats 1
# 单条目表：不掷骰（random value 0..0 是退化区间，游戏会拒）
scoreboard players set $rng doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0 run data merge storage doom.nats:sel {type:"minecraft:cat",slug:"cat",cat:"creature",min:1,max:1}
execute if score $rng doom.nats matches 0 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.creature"]}
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.rule doom.nats 7
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.place doom.nats 4
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.light doom.nats 2
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.tag doom.nats 1
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0 run scoreboard players set $sel.tall doom.nats 0
