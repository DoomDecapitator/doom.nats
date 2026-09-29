# doom.nats:grp/mem/camel —— 成员级组数据施加（@s = 刚生成的那只）
# 由 doom.nats:post/camel 在 execute summon 的上下文里调用。

# AgeableMobGroupData(0.05)：首只恒成年，之后每只掷一次
# 幼年态用 Age:-24000（AgeableMob 的存档键是 int Age；IsBaby 只有僵尸系自己实现）
execute if score $grp.mem doom.nats matches 1.. run execute store result score $grp.r doom.nats run random value 1..10000
execute if score $grp.mem doom.nats matches 1.. if score $grp.r doom.nats matches ..500 run data merge entity @s {Age:-24000}
scoreboard players add $grp.mem doom.nats 1
