# doom.nats:grp/init/mooshroom —— 一组开始时的组数据（SpawnGroupData 复刻）
# 由 spawn/pick_one 在"本组首次抽中物种"后调用一次；@s 无意义，位置=候选点。

scoreboard players set $grp.mem doom.nats 0
# $grp.vneed：本组是否还欠一次"首只变体掷骰"（v4.17）；1 ⇒ 由 grp/mem 的首只分支消费
scoreboard players set $grp.vneed doom.nats 0
