# doom.nats:ctrl/tick —— 每分钟结算一次密度目标（由 core/tick 每 tick 调用）
scoreboard players add $ctrl.t doom.nats 1
scoreboard players operation $ctrl.t doom.nats %= #1200 doom.nats
execute if score $ctrl.t doom.nats matches 0 run function doom.nats:ctrl/settle
