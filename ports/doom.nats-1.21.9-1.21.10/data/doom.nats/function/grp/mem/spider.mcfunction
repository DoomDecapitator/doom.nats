# doom.nats:grp/mem/spider —— 成员级组数据施加（@s = 刚生成的那只）
# 由 doom.nats:post/spider 在 execute summon 的上下文里调用。

execute if data storage doom.nats:grp fx run function doom.nats:grp/fx_apply with storage doom.nats:grp
scoreboard players add $grp.mem doom.nats 1
