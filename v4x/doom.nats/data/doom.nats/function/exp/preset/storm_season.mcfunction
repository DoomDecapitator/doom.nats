# doom.nats:exp/preset/storm_season —— 预设「storm_season」
# 由 doom.nats:exp/preset 调用（merge 语义：可叠加；reset 一键还原）
# 预设：雷暴季（实验性）：雷暴时才进池的"风暴猎手"（充能苦力怕）+ 雷暴期间怪物上限抬高
# merge 语义：可叠加，reset/enable 一键还原

data modify storage doom.nats:exp counts.capByY merge value {monster:[{yMin:-2147483648,yMax:2147483647,max:200,localMax:140}]}
execute unless data storage doom.nats:exp entries[8] run data modify storage doom.nats:exp entries set value []
execute unless data storage doom.nats:exp entries[8] run data modify storage doom.nats:exp entries append value {id:"storm_hunter",mob:"minecraft:creeper",biome:"#minecraft:is_overworld",category:"monster",weight:25,min:1,max:2,when:{thundering:1b},nbt:"{powered:1b,CustomName:'{\"text\":\"风暴猎手\",\"color\":\"yellow\"}'}",on_spawn:1b}
data modify storage doom.nats:exp enabled set value 1b
function doom.nats:exp/load
