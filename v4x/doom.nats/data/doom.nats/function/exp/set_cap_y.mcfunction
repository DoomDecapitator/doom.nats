# doom.nats:exp/set_cap_y [MACRO] —— 追加一段"该类容量"的 Y 段
# 用法：data merge storage doom.nats:exp_in {category:"monster",yMax:0,max:200,localMax:140}
#       function doom.nats:exp/set_cap_y   （max=全局容量 / localMax=每玩家上限；两个都能单独给）
$execute unless data storage doom.nats:exp counts.capByY."$(category)" run data modify storage doom.nats:exp counts.capByY."$(category)" set value []
$execute if data storage doom.nats:exp counts.capByY."$(category)"[8] run tellraw @s [{"text":"该类别的 Y 段已满（上限 8 段）","color":"red"}]
$execute unless data storage doom.nats:exp counts.capByY."$(category)"[8] run data modify storage doom.nats:exp counts.capByY."$(category)" append value {yMin:$(yMin),yMax:$(yMax),max:$(max),localMax:$(localMax)}
say [nats.exp] set_cap_y 已写入（改 storage 即刻生效）

