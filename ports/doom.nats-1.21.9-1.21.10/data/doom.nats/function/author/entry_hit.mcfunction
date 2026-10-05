# doom.nats:author/entry_hit [MACRO] —— 一条运行时刻条目的条件判定 + 加权派发
# 用法：function doom.nats:author/entry_hit with storage doom.nats:author_rt e
# 条件（全部 AND）：类别匹配 + 群系匹配 + 天气 + Y 窗口 + 亮度窗口。
scoreboard players set $auth.ok doom.nats 1
$execute unless data storage doom.nats:author_rt e{category:"$(cat)"} run scoreboard players set $auth.ok doom.nats 0
$execute unless biome ~ ~ ~ $(biome) run scoreboard players set $auth.ok doom.nats 0
execute if score $auth.ok doom.nats matches 1 if score $auth.th doom.nats matches 1 unless predicate doom.nats:weather/thunder run scoreboard players set $auth.ok doom.nats 0
execute if score $auth.ok doom.nats matches 1 if score $auth.ra doom.nats matches 1 unless predicate doom.nats:weather/rain run scoreboard players set $auth.ok doom.nats 0
$execute if score $auth.ok doom.nats matches 1 unless score $py doom.nats matches $(yMin).. run scoreboard players set $auth.ok doom.nats 0
$execute if score $auth.ok doom.nats matches 1 unless score $py doom.nats matches ..$(yMax) run scoreboard players set $auth.ok doom.nats 0
$execute if score $auth.ok doom.nats matches 1 unless predicate doom.nats:author/run/light_le_$(lightMax) run scoreboard players set $auth.ok doom.nats 0
$execute if score $auth.ok doom.nats matches 1 unless predicate doom.nats:author/run/light_ge_$(lightMin) run scoreboard players set $auth.ok doom.nats 0
# 条件成立 ⇒ 并入权重和，命中区间 = #off..#hi（#off 只在条件成立时前进 ⇒ 多条目之间无空档）
execute if score $auth.ok doom.nats matches 1 run scoreboard players operation #hi doom.nats = #off doom.nats
execute if score $auth.ok doom.nats matches 1 run scoreboard players operation #hi doom.nats += $auth.w doom.nats
execute if score $auth.ok doom.nats matches 1 run scoreboard players operation #wsum doom.nats += $auth.w doom.nats
execute if score $auth.ok doom.nats matches 1 if score $rng doom.nats >= #off doom.nats if score $rng doom.nats < #hi doom.nats run function doom.nats:author/entry_take with storage doom.nats:author_rt e
execute if score $auth.ok doom.nats matches 1 run scoreboard players operation #off doom.nats += $auth.w doom.nats
