# doom.nats:mob/fortress —— 下界要塞固定刷怪表（等价 NetherFortressStructure.FORTRESS_ENEMIES，权重和 28）
# 触发：doom.nats:mob/biome/<群系>/monster 的**结构前置**（v4.18 起）—— 即 "本次抽中的类别是 monster ∧ 位置在 fortress 内（piece 级）"。
#   原版有两条同表路径（NaturalSpawner.mobsAt:276-290）：①硬编码"下方是下界砖 ∧ 要塞内"；
#   ②要塞 JSON 的 spawn_overrides（monster / piece，"下方不是下界砖"时才走到）。本表被两条共用。

scoreboard players set #wsum doom.nats 28
scoreboard players operation $rng doom.nats %= #wsum doom.nats
scoreboard players set $cost.threshold doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 0..9 run data merge storage doom.nats:sel {type:"minecraft:blaze",slug:"blaze",cat:"monster",min:2,max:3}
execute if score $rng doom.nats matches 0..9 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.monster"]}
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.rule doom.nats 4
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 0..9 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 10..14 run data merge storage doom.nats:sel {type:"minecraft:zombified_piglin",slug:"zombified_piglin",cat:"monster",min:4,max:4}
execute if score $rng doom.nats matches 10..14 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.monster"]}
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.rule doom.nats 25
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 10..14 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 15..22 run data merge storage doom.nats:sel {type:"minecraft:wither_skeleton",slug:"wither_skeleton",cat:"monster",min:5,max:5}
execute if score $rng doom.nats matches 15..22 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.monster"]}
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.rule doom.nats 12
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 15..22 run scoreboard players set $sel.tall doom.nats 1
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 23..24 run data merge storage doom.nats:sel {type:"minecraft:skeleton",slug:"skeleton",cat:"monster",min:5,max:5}
execute if score $rng doom.nats matches 23..24 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.monster"]}
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.rule doom.nats 5
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.light doom.nats 1
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 23..24 run scoreboard players set $sel.tall doom.nats 0
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.ok doom.nats 1
execute if score $rng doom.nats matches 25..27 run data merge storage doom.nats:sel {type:"minecraft:magma_cube",slug:"magma_cube",cat:"monster",min:4,max:4}
execute if score $rng doom.nats matches 25..27 run data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.monster"]}
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.rule doom.nats 4
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.place doom.nats 0
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.light doom.nats 0
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.tag doom.nats 0
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.grp1 doom.nats 0
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.cluster doom.nats 4
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.wide doom.nats 0
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.wide2 doom.nats 0
execute if score $rng doom.nats matches 25..27 run scoreboard players set $sel.tall doom.nats 0
