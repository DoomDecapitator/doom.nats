# doom.nats:exp/preset/blood_moon —— 预设「blood_moon」
# 由 doom.nats:exp/preset 调用（merge 语义：可叠加；reset 一键还原）
# 预设：血月（实验性）：僵尸/骷髅成组更大、怪物上限抬高，并加一条自带力量效果的"血月行者"
# merge 语义：可叠加，reset/enable 一键还原

data modify storage doom.nats:exp counts.groupByY merge value {"minecraft:zombie":[{yMin:-2147483648,yMax:2147483647,min:3,max:5}]}
data modify storage doom.nats:exp counts.groupByY merge value {"minecraft:skeleton":[{yMin:-2147483648,yMax:2147483647,min:3,max:5}]}
data modify storage doom.nats:exp counts.capByY merge value {monster:[{yMin:-2147483648,yMax:2147483647,max:200,localMax:140}]}
execute unless data storage doom.nats:exp entries[8] run data modify storage doom.nats:exp entries set value []
execute unless data storage doom.nats:exp entries[8] run data modify storage doom.nats:exp entries append value {id:"blood_moon_walker",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:30,min:2,max:3,when:{yMax:63},nbt:"{CustomName:'{\"text\":\"血月行者\",\"color\":\"red\"}',active_effects:[{id:\"minecraft:strength\",amplifier:1b,duration:-1,show_particles:0b,show_icon:1b}]}",on_spawn:1b}
data modify storage doom.nats:exp enabled set value 1b
function doom.nats:exp/load
