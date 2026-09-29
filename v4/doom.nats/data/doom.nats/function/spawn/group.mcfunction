# doom.nats:spawn/group —— 一组：count = ceil(rand*4)（此处用 1..4 近似，0 的概率可忽略）
scoreboard players remove $grp doom.nats 1
# 每组从原点重新起算（源码：x/z 是组内局部变量）+ 本组物种只抽一次
scoreboard players operation $wx doom.nats = $wx0 doom.nats
scoreboard players operation $wz doom.nats = $wz0 doom.nats
scoreboard players set $grp.sel doom.nats 0
scoreboard players set $grp.sized doom.nats 0
scoreboard players set $grp.stop doom.nats 0
scoreboard players set $grp.inited doom.nats 0
# v4.3：源码里 x/z 是**组内局部变量**，每组都从 pack 原点重新起算；跨组累加会让点位漂到 128 格外
execute store result score $cnt doom.nats run random value 1..4
function doom.nats:spawn/walk
execute if score $grp doom.nats matches 1.. if score $att.stop doom.nats matches 0 if score $grp.stop doom.nats matches 0 run function doom.nats:spawn/group
