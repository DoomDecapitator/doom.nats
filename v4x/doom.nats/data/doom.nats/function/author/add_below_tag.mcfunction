# doom.nats:author/add_below_tag [MACRO] —— 追加一条"额外落位面"标签
# 用法：data merge storage doom.nats:author_in {type:"minecraft:zombie",tag:"#minecraft:leaves"}
#       function doom.nats:author/add_below_tag
$execute unless data storage doom.nats:author entityRules."$(type)".belowAny run data modify storage doom.nats:author entityRules."$(type)".belowAny set value []
$execute if data storage doom.nats:author entityRules."$(type)".belowAny[8] run tellraw @s [{"text":"belowAny 已满（上限 8 条）","color":"red"}]
$execute unless data storage doom.nats:author entityRules."$(type)".belowAny[8] run data modify storage doom.nats:author entityRules."$(type)".belowAny append value "$(tag)"
say [nats.author] add_below_tag 已写入（改 storage 即刻生效）

