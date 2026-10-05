# T6 —— predicate 可解析（每个样本"if 或 unless"必命中一次 ⇒ 恒等于样本数）
# 原理：对每个 predicate 同时写 if / unless 两路，二者必有其一生效 ⇒ 每个样本恒 +1。
#   · 若 predicate 本身无法解析 ⇒ 该行报错、不再 +1 ⇒ 计数缺失 ⇒ FAIL
#   · 与"该 predicate 在此处是否成立"无关 ⇒ 版本无关、位置无关
scoreboard players set #t.n nats.test 0
execute if predicate doom.nats:author/run/weather_any run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:author/run/weather_any run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:spawn/bright_enough run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:spawn/bright_enough run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:spawn/in_ancient_city run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:spawn/in_ancient_city run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:author/run/light_ge_0 run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:author/run/light_ge_0 run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:author/run/light_le_15 run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:author/run/light_le_15 run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:grp/biome/spawns_gold_rabbits run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:grp/biome/spawns_gold_rabbits run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:weather/rain run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:weather/rain run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:light/tier_0 run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:light/tier_0 run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:spawn/in_fortress run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:spawn/in_fortress run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:spawn/biome_river run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:spawn/biome_river run scoreboard players add #t.n nats.test 1
execute if predicate doom.nats:weather/thunder run scoreboard players add #t.n nats.test 1
execute unless predicate doom.nats:weather/thunder run scoreboard players add #t.n nats.test 1
scoreboard players set #t.ok nats.test 0
execute if score #t.n nats.test matches 11.. run scoreboard players set #t.ok nats.test 1
execute store result storage doom.nats:gt pred_hits int 1 run scoreboard players get #t.n nats.test
function doom_nats_test:_assert {name:"predicates_resolvable", detail:"a predicate failed to resolve (expect 11 samples, each hit exactly once)"}
