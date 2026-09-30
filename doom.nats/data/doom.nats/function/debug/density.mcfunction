# doom.nats:debug/density —— 看密度控制现状（聊天栏 + 服务器日志）
execute store result storage doom.nats:rep density int 1 run scoreboard players get $density doom.nats
execute store result storage doom.nats:rep batch int 1 run scoreboard players get $eff.batch doom.nats
execute store result storage doom.nats:rep period int 1 run scoreboard players get $eff.period doom.nats
execute store result storage doom.nats:rep perMin int 1 run scoreboard players get $ctrl.now doom.nats
execute store result storage doom.nats:rep cap int 1 run scoreboard players get $cap.monster doom.nats
function doom.nats:debug/say_density with storage doom.nats:rep
tellraw @a [{"text":"[density] ","color":"dark_gray"},{"text":"目标/分钟=","color":"gray"},{"score":{"name":"$density","objective":"doom.nats"},"color":"white"},{"text":"  上一分钟=","color":"gray"},{"score":{"name":"$ctrl.now","objective":"doom.nats"},"color":"white"},{"text":"  batch=","color":"gray"},{"score":{"name":"$eff.batch","objective":"doom.nats"},"color":"aqua"},{"text":"  period=","color":"gray"},{"score":{"name":"$eff.period","objective":"doom.nats"},"color":"aqua"}]
