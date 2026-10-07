# doom.nats:scale/dense —— 密集：上限一倍半
# 写进 config 层（跨 /reload 保留）；想恢复原样就跑 scale/normal。

data modify storage doom.nats:config qty set value 150
data remove storage doom.nats:config period
function doom.nats:cfg/apply
tellraw @a [{"text":"[nats] ","color":"aqua"},{"text":"已切换刷怪规模：密集：上限一倍半","color":"white"},{"text":"（想自己细调：/data merge storage doom.nats:config {qty:80} 然后 /function doom.nats:cfg/apply）","color":"gray"}]
