# doom.nats:scale/extreme —— 极端：上限四倍 + 节拍最快（吃性能，谨慎）
# 写进 config 层（跨 /reload 保留）；想恢复原样就跑 scale/normal。

data modify storage doom.nats:config qty set value 400
data modify storage doom.nats:config period set value 3
function doom.nats:cfg/apply
tellraw @a [{"text":"[nats] ","color":"aqua"},{"text":"已切换刷怪规模：极端：上限四倍 + 节拍最快（吃性能，谨慎）","color":"white"},{"text":"（想自己细调：/data merge storage doom.nats:config {qty:80} 然后 /function doom.nats:cfg/apply）","color":"gray"}]
