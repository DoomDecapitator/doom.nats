# doom.nats:grp/init/spider —— 一组开始时的组数据（SpawnGroupData 复刻）
# 由 spawn/pick_one 在"本组首次抽中物种"后调用一次；@s 无意义，位置=候选点。

scoreboard players set $grp.mem doom.nats 0
# $grp.vneed：本组是否还欠一次"首只变体掷骰"（v4.17）；1 ⇒ 由 grp/mem 的首只分支消费
scoreboard players set $grp.vneed doom.nats 0
# SpiderEffectsGroupData：HARD ∧ rand < 0.1*special ⇒ 整组同一个效果（nextInt(5)：0,1 速度 2 力量 3 再生 4 隐身）
scoreboard players set $grp.fx doom.nats 0
data remove storage doom.nats:grp fx
execute if score $cfg.difficulty doom.nats matches 3 run execute store result score $grp.r doom.nats run random value 1..10000
execute if score $cfg.difficulty doom.nats matches 3 if score $grp.r doom.nats <= $cfg.special_x10 doom.nats run execute store result score $grp.t doom.nats run random value 0..4
execute if score $cfg.difficulty doom.nats matches 3 if score $grp.r doom.nats <= $cfg.special_x10 doom.nats if score $grp.t doom.nats matches 0..1 run data modify storage doom.nats:grp fx set value "speed"
execute if score $cfg.difficulty doom.nats matches 3 if score $grp.r doom.nats <= $cfg.special_x10 doom.nats if score $grp.t doom.nats matches 2 run data modify storage doom.nats:grp fx set value "strength"
execute if score $cfg.difficulty doom.nats matches 3 if score $grp.r doom.nats <= $cfg.special_x10 doom.nats if score $grp.t doom.nats matches 3 run data modify storage doom.nats:grp fx set value "regeneration"
execute if score $cfg.difficulty doom.nats matches 3 if score $grp.r doom.nats <= $cfg.special_x10 doom.nats if score $grp.t doom.nats matches 4 run data modify storage doom.nats:grp fx set value "invisibility"
