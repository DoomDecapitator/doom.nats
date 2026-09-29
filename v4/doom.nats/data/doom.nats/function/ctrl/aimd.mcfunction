# doom.nats:ctrl/aimd —— 低于目标就加批、超目标 25% 就减批（batch ∈ [1,40]）
execute if score $ctrl.now doom.nats < $density doom.nats if score $eff.batch doom.nats < $ctrl.maxBatch doom.nats run scoreboard players add $eff.batch doom.nats 1
scoreboard players operation $ctrl.hi doom.nats = $density doom.nats
scoreboard players operation $ctrl.hi doom.nats *= #5 doom.nats
scoreboard players operation $ctrl.hi doom.nats /= #4 doom.nats
# 超目标：按比例一步收缩（一分钟只降 1 会爬得太慢）
scoreboard players operation $ctrl.new doom.nats = $eff.batch doom.nats
scoreboard players operation $ctrl.new doom.nats *= $density doom.nats
execute if score $ctrl.now doom.nats matches 1.. if score $ctrl.now doom.nats > $ctrl.hi doom.nats run scoreboard players operation $ctrl.new doom.nats /= $ctrl.now doom.nats
execute if score $ctrl.new doom.nats matches ..0 run scoreboard players set $ctrl.new doom.nats 1
execute if score $ctrl.now doom.nats > $ctrl.hi doom.nats run scoreboard players operation $eff.batch doom.nats = $ctrl.new doom.nats
