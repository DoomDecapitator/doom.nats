# doom.nats:post/ocelot —— 生成后的收尾（execute summon 的 run 目标，@s = 新生成的那只）
#
# 为什么不是"重写 finalizeSpawn"：execute summon → SummonCommand.createEntity(..., COMMAND, true)
#   内部已经替我们跑过 vanilla 的 finalizeSpawn（含装备/变体/婴儿/骑士/属性）。这里只补三件事：
#   ① 本包标签与规则 NBT（原来的 summon NBT 参数）② 全局持久化开关 ③ 组数据（SpawnGroupData）
$data merge entity @s $(nbt)
execute if score $cfg.persist doom.nats matches 1 run data merge entity @s {PersistenceRequired:1b}
# 朝向：rot 由 spawn/emit 掷好（宏参数必须在本函数实例化前就位）——此处只负责施加
$tp @s ~ ~ ~ $(rot) 0
# ③a 共享变体的"首只掷骰"：**必须在 grp/mem 实例化之前**跑完 —— grp/mem 是宏函数，
#     它的 $(v) 在实例化的那一刻就要存在，否则整函数失效（Missing argument v）。
#     位置语义不变：本函数由 execute summon 的 run 调用，@s = 刚生成的那只 ⇒ 用它的生成点求值。
# ③b 组数据（成员级；$grp.mem 在函数末尾自增，故"首只/成员 2+/成员 3+"判定天然对齐原版）
function doom.nats:grp/mem/ocelot with storage doom.nats:grp
