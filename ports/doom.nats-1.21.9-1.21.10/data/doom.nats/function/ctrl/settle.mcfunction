# doom.nats:ctrl/settle —— 结算上一分钟的生成数与目标，AIMD 调 $eff.batch
# 本分钟生成数 = $spawned.total（累积、不被 reject_report 清零）之差
scoreboard players operation $ctrl.now doom.nats = $spawned.total doom.nats
scoreboard players operation $ctrl.now doom.nats -= $ctrl.last doom.nats
scoreboard players operation $ctrl.last doom.nats = $spawned.total doom.nats
execute if score $density doom.nats matches 1.. run function doom.nats:ctrl/aimd
