# doom.nats:grp/mem/husk —— 成员级组数据施加（@s = 刚生成的那只）
# 由 doom.nats:post/husk 在 execute summon 的上下文里调用。

execute if score $grp.baby doom.nats matches 1 run data merge entity @s {IsBaby:1b}
# 非婴儿组要显式清零：execute summon 走的 finalizeSpawn 拿的是 null 组数据，会**每只**独立掷 5%
execute if score $grp.baby doom.nats matches 0 run data merge entity @s {IsBaby:0b}
scoreboard players add $grp.mem doom.nats 1
