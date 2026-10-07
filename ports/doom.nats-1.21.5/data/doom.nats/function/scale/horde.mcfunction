# doom.nats:scale/horde —— 尸潮：上限两倍半 + 节拍加快
# 写进 config 层（跨 /reload 保留）；想恢复原样就跑 scale/normal。

data modify storage doom.nats:config qty set value 250
data modify storage doom.nats:config period set value 4
function doom.nats:cfg/apply
tellraw @a [{"text":"[nats] ","color":"aqua"},{"text":"已切换刷怪规模：尸潮：上限两倍半 + 节拍加快","color":"white"},{"text":"（想自己细调：/data merge storage doom.nats:config {qty:80} 然后 /function doom.nats:cfg/apply）","color":"gray"}]
