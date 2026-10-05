# doom.nats:post/bogged —— 生成后的收尾（execute summon 的 run 目标，@s = 新生成的那只）
#
# 为什么不是"重写 finalizeSpawn"：execute summon → SummonCommand.createEntity(..., COMMAND, true)
#   内部已经替我们跑过 vanilla 的 finalizeSpawn（含装备/变体/婴儿/骑士/属性）。这里只补三件事：
#   ① 本包标签与规则 NBT（原来的 summon NBT 参数）② 全局持久化开关 ③ 组数据（SpawnGroupData）
$data merge entity @s $(nbt)
execute if score $cfg.persist doom.nats matches 1 run data merge entity @s {PersistenceRequired:1b}
# 朝向：rot 由 spawn/emit 掷好（宏参数必须在本函数实例化前就位）——此处只负责施加
$tp @s ~ ~ ~ $(rot) 0
# ③ 该物种在原版不参与 SpawnGroupData（或只有跟队语义）⇒ 无组数据
