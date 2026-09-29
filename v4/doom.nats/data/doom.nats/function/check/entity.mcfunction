# doom.nats:check/entity —— 逐实体规则（reason=9，由 tools/gen_ctm_check.mjs 从规则表生成，勿手改）
#
# 规则编号 ↔ 实体 ↔ 源码出处见 doom.nats/_work/generated/entity-rules.json
# 与 _work/ref/spawn-rules-digest.txt（44 条谓词的源码速览）

execute if score $sel.rule doom.nats matches 3 run function doom.nats:check/coin_half
execute if score $sel.rule doom.nats matches 3 if score $py doom.nats > $snap.py doom.nats run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 8 if predicate doom.nats:spawn/biome_river run function doom.nats:check/coin_1of50
execute if score $sel.rule doom.nats matches 8 unless entity @a[gamemode=!spectator,distance=..64] run function doom.nats:check/fail {reason:2}
execute if score $sel.rule doom.nats matches 11 unless block ~ ~-1 ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 11 unless predicate doom.nats:spawn/biome_more_drowned run function doom.nats:check/drowned_deep
execute if score $sel.rule doom.nats matches 11 if predicate doom.nats:spawn/biome_more_drowned run function doom.nats:check/coin_1of15
execute if score $sel.rule doom.nats matches 15 run function doom.nats:check/coin_1of20
execute if score $sel.rule doom.nats matches 16 if score $py doom.nats > $chk.sea_glow doom.nats run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 18 run function doom.nats:check/coin_1of20
execute if score $sel.rule doom.nats matches 18 if predicate doom.nats:spawn/can_see_sky run function doom.nats:check/coin_1of20
execute if score $sel.rule doom.nats matches 19 if block ~ ~-1 ~ minecraft:nether_wart_block run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 20 unless predicate doom.nats:spawn/can_see_sky run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 22 run function doom.nats:check/coin_2of3
execute if score $sel.rule doom.nats matches 25 if block ~ ~-1 ~ minecraft:nether_wart_block run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 26 if predicate doom.nats:spawn/biome_polar_alt unless block ~ ~-1 ~ #minecraft:polar_bears_spawnable_on_alternate run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 26 unless predicate doom.nats:spawn/biome_polar_alt unless block ~ ~-1 ~ #minecraft:animals_spawnable_on run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 28 run function doom.nats:check/coin_half
execute if score $sel.rule doom.nats matches 28 run function doom.nats:check/coin_moon
execute if score $sel.rule doom.nats matches 28 unless predicate doom.nats:spawn/biome_slime run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 28 if score $py doom.nats matches ..50 run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 28 if score $py doom.nats matches 70.. run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 30 if block ~ ~1 ~ minecraft:lava if block ~ ~2 ~ minecraft:lava if block ~ ~3 ~ minecraft:lava unless block ~ ~4 ~ minecraft:air run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 30 if block ~ ~1 ~ minecraft:lava if block ~ ~2 ~ minecraft:lava unless block ~ ~3 ~ minecraft:lava unless block ~ ~3 ~ minecraft:air run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 30 if block ~ ~1 ~ minecraft:lava unless block ~ ~2 ~ minecraft:lava unless block ~ ~2 ~ minecraft:air run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 30 unless block ~ ~1 ~ minecraft:lava unless block ~ ~1 ~ minecraft:air run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 31 if predicate doom.nats:spawn/biome_river run function doom.nats:check/coin_1of50
execute if score $sel.rule doom.nats matches 31 unless entity @a[gamemode=!spectator,distance=..64] run function doom.nats:check/fail {reason:2}
execute if score $sel.rule doom.nats matches 32 if score $py doom.nats >= $chk.sea_turtle doom.nats run function doom.nats:check/fail {reason:9}
# ---- v4.24 运行时刻作者层（storage doom.nats:author → entityRules.<实体>）
execute if score $auth.loaded doom.nats matches 1 run function doom.nats:author/rule_check with storage doom.nats:author_rt cur
execute if score $auth.loaded doom.nats matches 1 run function doom.nats:author/biome_check
