# doom.nats:check/light —— 光照判定（reason=3，按 $sel.light 分派）
#
# v4.13 关键修正：光照要求是**逐实体**的，不是全局的。
#   之前所有物种共用一档（默认 7）⇒ 动物同时被要求"亮 ≥ 9（check/block）**且**暗 ≤ 7"，永远刷不出来。
#   现在按实体规则里的 light 字段分派（表见 tools/lib/entity-rules.mjs）：
#     0 none   无光照要求（岩浆怪/恶魂/猪灵族/豹猫/炽足兽/水生…）
#     1 dark   综合亮度 ≤ $eff.light 档（Monster.isDarkEnoughToSpawn 的档位近似）
#     2 bright 亮度 ≥ 9 或能看到天空（Animal.isBrightEnoughToSpawn = getRawBrightness(pos,0) > 8 的近似）
#     3 bat    亮度 ≤ 3（万圣节 7；50% 掷币在 check/entity）
#     4 slime  亮度 ≤ 7（原版是 ≤ nextInt(8) 的采样比较；50% 与月相在 check/entity）
#     5 glow   亮度必须为 0（GlowSquid.checkGlowSquidSpawnRules）
#     6 bl8    方块光 ≤ 8 的近似（PatrollingMonster.checkPatrollingMonsterSpawnRules）
scoreboard players set $chk.lighttier doom.nats 7
execute if score $eff.light doom.nats matches 0 run scoreboard players set $chk.lighttier doom.nats 0
execute if score $eff.light doom.nats matches 1..3 run scoreboard players set $chk.lighttier doom.nats 3
execute if score $eff.light doom.nats matches 4..7 run scoreboard players set $chk.lighttier doom.nats 7
execute if score $eff.light doom.nats matches 8..11 run scoreboard players set $chk.lighttier doom.nats 11
execute if score $eff.light doom.nats matches 12.. run scoreboard players set $chk.lighttier doom.nats 15

execute if score $sel.light doom.nats matches 1 if score $chk.lighttier doom.nats matches 0 unless predicate doom.nats:light/tier_0 run function doom.nats:debug/light_fail {tier:0}
execute if score $sel.light doom.nats matches 1 if score $chk.lighttier doom.nats matches 3 unless predicate doom.nats:light/tier_3 run function doom.nats:debug/light_fail {tier:3}
execute if score $sel.light doom.nats matches 1 if score $chk.lighttier doom.nats matches 7 unless predicate doom.nats:light/tier_7 run function doom.nats:debug/light_fail {tier:7}
execute if score $sel.light doom.nats matches 1 if score $chk.lighttier doom.nats matches 11 unless predicate doom.nats:light/tier_11 run function doom.nats:debug/light_fail {tier:11}
execute if score $sel.light doom.nats matches 1 if score $chk.lighttier doom.nats matches 15 unless predicate doom.nats:light/tier_15 run function doom.nats:debug/light_fail {tier:15}

execute if score $sel.light doom.nats matches 2 unless predicate doom.nats:spawn/bright_enough run function doom.nats:debug/light_fail {tier:9}
execute if score $sel.light doom.nats matches 3 unless predicate doom.nats:light/tier_3 run function doom.nats:debug/light_fail {tier:3}
execute if score $sel.light doom.nats matches 4 unless predicate doom.nats:light/tier_7 run function doom.nats:debug/light_fail {tier:7}
execute if score $sel.light doom.nats matches 5 unless predicate doom.nats:light/tier_0 run function doom.nats:debug/light_fail {tier:0}
execute if score $sel.light doom.nats matches 6 unless predicate doom.nats:light/tier_8 run function doom.nats:debug/light_fail {tier:8}
