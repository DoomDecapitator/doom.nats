# doom.nats:grp/var/axolotl —— 共享变体的首次掷骰（v4.17：首只真正生成时、在它的生成点求值）
# 调用点：doom.nats:post/axolotl（**在调用 grp/mem 之前**，见那里的 ③a 注释）。@s = 刚生成的那只。
# 守卫：$grp.vneed==1（由 grp/init 置位，掷完消费）⇒ 严格"每组一次"。
#   ⚠ 不额外要求 $grp.mem==0：真实链路里"本组第一只"就是 $grp.mem==0 的那次调用；
#     但测试/作者可能直接以"成员 2+"身份调 post/<slug>（mem 已经非 0），若在这里拦一道，
#     $(v) 就只能靠兜底值 —— 那会让断言失去区分度。语义上"首次 post 调用"即"首只生成"。
# 为什么放这里：原版 groupData 由首只创建，掷骰用的群系/位置都是那只个体的 blockPosition
#   （NaturalSpawner.java:186 在 isValidPositionForMob(:254) 之后）。

# 组内共享变体：由本组**第一只真正生成**的个体在其生成点决定（其余沿用首只结果）
execute if score $grp.vneed doom.nats matches 1 run execute store result storage doom.nats:grp v int 1 run random value 0..3
# 消费掉"欠一次"标记：其余成员只会沿用上面掷出的结果
execute if score $grp.vneed doom.nats matches 1 run scoreboard players set $grp.vneed doom.nats 0
