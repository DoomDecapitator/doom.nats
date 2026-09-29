# doom.nats:exp/help —— 实验性层（非原版）用法
# 标 gold 的那些是**非原版**能力：只在 `enabled:1b` 时生效。
tellraw @s [{"text":"=== doom.nats 实验性层（非原版）（改 storage 即刻生效，不用重生成包）===","color":"aqua"}]
tellraw @s [{"text":"[1] 直接改 storage：","color":"yellow"},{"text":"data modify storage doom.nats:exp entityRules.\"minecraft:zombie\".belowAny set value [\"#minecraft:leaves\"]","color":"gray"}]
tellraw @s [{"text":"[2] 条目：","color":"yellow"},{"text":"data modify storage doom.nats:exp_in entry set value {id:\"x\",mob:\"minecraft:zombie\",biome:\"#minecraft:is_overworld\",category:\"monster\",weight:40,when:{thundering:1b}} + function doom.nats:exp/add_entry","color":"gray"}]
tellraw @s [{"text":"[3] 额外落位面：","color":"yellow"},{"text":"{type:\"minecraft:zombie\",tag:\"#minecraft:leaves\"} + doom.nats:exp/add_below_tag","color":"gray"}]
tellraw @s [{"text":"[4] 组大小随 Y：","color":"yellow"},{"text":"{type:\"minecraft:zombie\",yMax:0,min:4,max:6} + doom.nats:exp/set_group_by_y","color":"gray"}]
tellraw @s [{"text":"[5] 容量随 Y：","color":"yellow"},{"text":"{category:\"monster\",yMax:0,max:200,localMax:140} + doom.nats:exp/set_cap_y","color":"gray"}]
tellraw @s [{"text":"[6] 总开关：","color":"yellow"},{"text":"function doom.nats:exp/enable · disable（关掉 = 行为回滚）","color":"gray"}]
tellraw @s [{"text":"[7] 实验性能力（开关为 1 才生效）：条目 when.near{type,radius,min,max}（关系条件，非原版）· 条目 on_spawn:1b + 自查 doom.nats:exp/on_spawn/<id> 文件（演出钩子）· function doom.nats:exp/preset","color":"gold"}]
tellraw @s [{"text":"[6] 看/导出/重置：","color":"yellow"},{"text":"function doom.nats:exp/show · export · reset","color":"gray"}]
tellraw @s [{"text":"字段（entityRules）：belowAny(≤8) yMin yMax lightMin lightMax weather(thunder|rain|clear) biomeIn(≤4) biomeNot(≤4) place light persist","color":"white"}]
tellraw @s [{"text":"字段（entries）：id mob biome category weight min max nbt when{thundering raining yMin yMax lightMin lightMax}","color":"white"}]
tellraw @s [{"text":"上限：条目 ≤8 · Y 段 ≤8 · 落位面标签 ≤8 · 群系白/黑名单各 ≤4。未列出的构建期字段（coins/cluster/deep…）请在 rules/ 里改。","color":"dark_gray"}]
