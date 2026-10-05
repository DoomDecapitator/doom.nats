# doom.nats:grp/mem/wolf —— 成员级组数据施加（@s = 刚生成的那只）
# 由 doom.nats:post/wolf 在 execute summon 的上下文里调用。

# 组内共享变体：**首只真正生成时**在它的生成点掷一次（v4.17），其余沿用首只的结果
#   ⚠ 掷骰**不在这里**：本函数是**宏函数**，$(v) 在**实例化时**就必须存在（否则 Missing argument v，
#     整函数失效、组数据不施加）。⇒ 由调用方 doom.nats:post/wolf 在 `function ...grp/mem... with storage` **之前**调用 grp/var/wolf。
#     grp/init 已写入兜底值 ⇒ 即使跳过首只（直接以成员 2+ 身份调本函数）也不会整函数失效。
$data merge entity @s {variant:"$(v)"}
scoreboard players add $grp.mem doom.nats 1
