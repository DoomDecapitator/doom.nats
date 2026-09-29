# doom.nats:spawn/emit —— 生成宏（宏参数来自选物种结果 doom.nats:sel）
#
# 用法：function doom.nats:spawn/emit with storage doom.nats:sel
#   $(type) 实体 id、$(slug) 物种短名（派发 post/<slug>）
#
# v4.15：改用 execute summon。源码依据（SummonCommand.createEntity）——
#   execute summon 走 SummonCommand.createEntity(source, type, pos, {}, true)，
#   末尾那个 true 就是「对 Mob 调一次 finalizeSpawn(getCurrentDifficultyAt(pos), COMMAND, null)」，
#   而且发生在 tryAddFreshEntityWithPassengers **之前**，与 NaturalSpawner 的顺序一致。
#   ⇒ 单只层面的 finalizeSpawn（装备/武器/变体/婴儿/鸡骑士/蛛骑骷髅/僵尸首领/山羊角/村民数据…）
#     原版已替我们跑过；新实体还作为 @s 交给 run 的命令，给刚生成的那只补 NBT 再没有歧义
#     （旧写法 summon + @e[distance=..1,sort=nearest] 在同点连续生成时会认错人）。
# 朝向：vanilla 自然生成用 snapTo(..., random*360, 0)；宏参数必须在 post 实例化之前就位，所以在这里掷
# 注意：这一行不能写宏前缀 —— 不含任何参数占位符的行若带宏前缀，会让整个函数加载失败（实测）
execute store result storage doom.nats:sel rot int 1 run random value 0..359
$execute summon $(type) run function doom.nats:post/$(slug) with storage doom.nats:sel
