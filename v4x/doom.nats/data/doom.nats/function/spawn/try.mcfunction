# doom.nats:spawn/try —— 一次完整尝试（对齐"每类别每区块一次 pack"的结构）
#
# 容量(caps)、情形(eval)、群系(detect) 都在 doom.nats:circ/snapshot 的节拍里刷新，这里只管生成本身。
scoreboard players add $dbg.tries doom.nats 1
# 本次尝试的簇计数与停止位（vanilla：spawned >= getMaxSpawnClusterSize() 时 return 整个尝试）
scoreboard players set $att.spawned doom.nats 0
scoreboard players set $att.stop doom.nats 0
# $spawned 是**累计**成功数：清零只发生在 debug/reject_report（每 try 清零会让测量失去意义）
# v4.14h：整次尝试都在**某个玩家的上下文**里跑（取点、定位、合法性、生成）
#   否则 core/tick 的世界出生点上下文会让绝对坐标落到主世界上（下界/末地 0 生成）。
execute as @a[gamemode=!spectator,sort=random,limit=1] at @s run function doom.nats:spawn/try_at
