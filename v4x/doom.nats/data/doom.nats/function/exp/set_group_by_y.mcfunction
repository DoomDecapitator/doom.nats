# doom.nats:exp/set_group_by_y [MACRO] —— 追加一段"每次生几只"的 Y 段
# 用法：data merge storage doom.nats:exp_in {type:"minecraft:zombie",yMin:1,yMax:63,min:2,max:3}
#       function doom.nats:exp/set_group_by_y   （段按写入顺序求值，后面的覆盖前面的）
$execute unless data storage doom.nats:exp counts.groupByY."$(type)" run data modify storage doom.nats:exp counts.groupByY."$(type)" set value []
$execute if data storage doom.nats:exp counts.groupByY."$(type)"[8] run tellraw @s [{"text":"该物种的 Y 段已满（上限 8 段）","color":"red"}]
$execute unless data storage doom.nats:exp counts.groupByY."$(type)"[8] run data modify storage doom.nats:exp counts.groupByY."$(type)" append value {yMin:$(yMin),yMax:$(yMax),min:$(min),max:$(max)}
say [nats.exp] set_group_by_y 已写入（改 storage 即刻生效）

