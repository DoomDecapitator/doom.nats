# doom.nats:exp/entry_hit [MACRO] —— 一条运行时刻条目的条件判定 + 加权派发
# 用法：function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
# 条件（全部 AND）：类别匹配 + 群系匹配 + 天气 + Y 窗口 + 亮度窗口 + near（可选，实验性）。
scoreboard players set $exp.ok doom.nats 1
$execute unless data storage doom.nats:exp_rt e{category:"$(cat)"} run scoreboard players set $exp.ok doom.nats 0
$execute unless biome ~ ~ ~ $(biome) run scoreboard players set $exp.ok doom.nats 0
execute if score $exp.ok doom.nats matches 1 if score $exp.th doom.nats matches 1 unless predicate doom.nats:weather/thunder run scoreboard players set $exp.ok doom.nats 0
execute if score $exp.ok doom.nats matches 1 if score $exp.ra doom.nats matches 1 unless predicate doom.nats:weather/rain run scoreboard players set $exp.ok doom.nats 0
$execute if score $exp.ok doom.nats matches 1 unless score $py doom.nats matches $(yMin).. run scoreboard players set $exp.ok doom.nats 0
$execute if score $exp.ok doom.nats matches 1 unless score $py doom.nats matches ..$(yMax) run scoreboard players set $exp.ok doom.nats 0
$execute if score $exp.ok doom.nats matches 1 unless predicate doom.nats:author/run/light_le_$(lightMax) run scoreboard players set $exp.ok doom.nats 0
$execute if score $exp.ok doom.nats matches 1 unless predicate doom.nats:author/run/light_ge_$(lightMin) run scoreboard players set $exp.ok doom.nats 0
# near（实验性 · 非原版语义）：每次尝试最多 1 次计数查询
execute if score $exp.ok doom.nats matches 1 if data storage doom.nats:exp_rt near.type run function doom.nats:exp/near with storage doom.nats:exp_rt near
# 条件成立 ⇒ 并入权重和，命中区间 = #off..#hi（#off 只在条件成立时前进 ⇒ 多条目之间无空档）
execute if score $exp.ok doom.nats matches 1 run scoreboard players operation #hi doom.nats = #off doom.nats
execute if score $exp.ok doom.nats matches 1 run scoreboard players operation #hi doom.nats += $exp.w doom.nats
execute if score $exp.ok doom.nats matches 1 run scoreboard players operation #wsum doom.nats += $exp.w doom.nats
execute if score $exp.ok doom.nats matches 1 if score $rng doom.nats >= #off doom.nats if score $rng doom.nats < #hi doom.nats run function doom.nats:exp/entry_take with storage doom.nats:exp_rt e
execute if score $exp.ok doom.nats matches 1 run scoreboard players operation #off doom.nats += $exp.w doom.nats
