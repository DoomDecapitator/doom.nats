# doom.nats:util/void_kill —— 静默移除（对齐原版 discard()）
#
# 为什么不用 kill：kill 会掉战利品、给经验、触发死亡逻辑；而原版的**消失/超距移除**调用的是 discard()，
# 什么都不掉、也没有死亡动画/音效。做法与原作 recovered/doom.nats 的 void_kill 完全一致：
# 把实体丢到世界下方（y-500）⇒ 下一 tick 因超出世界被静默 discard。
#
# 用法：execute as <实体> run function doom.nats:util/void_kill
tp @s ~ ~-500 ~
