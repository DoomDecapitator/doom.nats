# doom.nats:spawn/walk —— 组内逐只：累加偏移后跳到新点（y 不变，与源码一致）
# 组内累加：由 group 负责重置原点（v4.10 修：以前每只都重置 ⇒ 簇太紧，不像原版的随机游走）
scoreboard players remove $cnt doom.nats 1
# x += nextInt(6) - nextInt(6)   ≡ (0..5) - (0..5)
execute store result score $ax doom.nats run random value 0..5
execute store result score $bx doom.nats run random value 0..5
scoreboard players operation $ax doom.nats -= $bx doom.nats
scoreboard players operation $wx doom.nats += $ax doom.nats
# z += nextInt(6) - nextInt(6)
execute store result score $az doom.nats run random value 0..5
execute store result score $bz doom.nats run random value 0..5
scoreboard players operation $az doom.nats -= $bz doom.nats
scoreboard players operation $wz doom.nats += $az doom.nats
# 跳到新点（y 用 ~ 保持：pack 内 y 不变）
execute store result storage doom.nats:pt x int 1 run scoreboard players get $wx doom.nats
execute store result storage doom.nats:pt z int 1 run scoreboard players get $wz doom.nats
function doom.nats:spawn/point with storage doom.nats:pt
execute if score $cnt doom.nats matches 1.. if score $att.stop doom.nats matches 0 if score $grp.stop doom.nats matches 0 run function doom.nats:spawn/walk
