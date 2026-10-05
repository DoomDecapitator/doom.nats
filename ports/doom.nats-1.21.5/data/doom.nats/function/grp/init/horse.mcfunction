# doom.nats:grp/init/horse —— 一组开始时的组数据（SpawnGroupData 复刻）
# 由 spawn/pick_one 在"本组首次抽中物种"后调用一次；@s 无意义，位置=候选点。

scoreboard players set $grp.mem doom.nats 0
# $grp.vneed：本组是否还欠一次"首只变体掷骰"（v4.17）；1 ⇒ 由 grp/mem 的首只分支消费
scoreboard players set $grp.vneed doom.nats 0
# 共享变体**不在这里掷**（v4.17）：原版 groupData 由"首只真正生成的个体"创建，位置也取那只的
#   blockPosition ⇒ 掷骰推迟到 doom.nats:grp/var/horse（由 post/horse 在调用 grp/mem 之前调用）
# 但这里必须留一个**合法兜底值**：grp/mem/<slug> 是宏函数，$(v) 在**实例化那一刻**就必须存在
#   （否则 Missing argument v ⇒ 整个 grp/mem 失效：婴儿/幼年/效果都不施加）。兜底值取 vanilla 在
#   "没有群系条件命中"时的默认分支；真实链路里首只生成时会被 grp/var/<slug> 覆盖。
#   为什么需要它：测试/作者可能直接以"成员 2+"身份调 post/<slug>（跳过 $grp.mem==0 那一只），
#   此时 grp/var 不跑 —— 有兜底值就不会整函数失效。
data modify storage doom.nats:grp v set value 0
scoreboard players set $grp.vneed doom.nats 1
