# doom.nats:exp/preset/deep_dark —— 预设「deep_dark」
# 由 doom.nats:exp/preset 调用（merge 语义：可叠加；reset 一键还原）
# 预设：深暗层（实验性）：僵尸只在 y≤0 出现、骷髅成组更大，并加一条带黑暗效果的"深暗潜行者"
# merge 语义：可叠加，reset/enable 一键还原

data modify storage doom.nats:exp entityRules merge value {"minecraft:zombie":{yMax:0}}
data modify storage doom.nats:exp counts.groupByY merge value {"minecraft:skeleton":[{yMin:-2147483648,yMax:0,min:2,max:4}]}
execute unless data storage doom.nats:exp entries[8] run data modify storage doom.nats:exp entries set value []
execute unless data storage doom.nats:exp entries[8] run data modify storage doom.nats:exp entries append value {id:"deep_dark_stalker",mob:"minecraft:skeleton",biome:"#minecraft:is_overworld",category:"monster",weight:30,min:1,max:2,when:{yMax:0},nbt:"{CustomName:'{\"text\":\"深暗潜行者\",\"color\":\"dark_purple\"}',active_effects:[{id:\"minecraft:darkness\",amplifier:0b,duration:-1,show_particles:0b,show_icon:1b}]}",on_spawn:1b}
data modify storage doom.nats:exp enabled set value 1b
function doom.nats:exp/load
