# doom.nats:grp/mem/horse —— 成员级组数据施加（@s = 刚生成的那只）
# 由 doom.nats:post/horse 在 execute summon 的上下文里调用。

# AgeableMobGroupData(0.05)：首只恒成年，之后每只掷一次
# 幼年态用 Age:-24000（AgeableMob 的存档键是 int Age；IsBaby 只有僵尸系自己实现）
execute if score $grp.mem doom.nats matches 1.. run execute store result score $grp.r doom.nats run random value 1..10000
execute if score $grp.mem doom.nats matches 1.. if score $grp.r doom.nats matches ..500 run data merge entity @s {Age:-24000}
# 组内共享变体：**首只真正生成时**在它的生成点掷一次（v4.17），其余沿用首只的结果
#   ⚠ 掷骰**不在这里**：本函数是**宏函数**，$(v) 在**实例化时**就必须存在（否则 Missing argument v，
#     整函数失效、组数据不施加）。⇒ 由调用方 doom.nats:post/horse 在 `function ...grp/mem... with storage` **之前**调用 grp/var/horse。
#     grp/init 已写入兜底值 ⇒ 即使跳过首只（直接以成员 2+ 身份调本函数）也不会整函数失效。
# 马：Variant 是"变体 | 纹样<<8"的合成值，只替换低 8 位，保留每只各自的 Markings
scoreboard players set #256 doom.nats 256
execute store result score $h.cur doom.nats run data get entity @s Variant
scoreboard players operation $h.m doom.nats = $h.cur doom.nats
scoreboard players operation $h.m doom.nats /= #256 doom.nats
scoreboard players operation $h.m doom.nats %= #256 doom.nats
scoreboard players operation $h.m doom.nats *= #256 doom.nats
execute store result score $h.v doom.nats run data get storage doom.nats:grp v
scoreboard players operation $h.m doom.nats += $h.v doom.nats
execute store result storage doom.nats:grp h int 1 run scoreboard players get $h.m doom.nats
# $(h) 是**每只各自**的值（各自的 Markings）⇒ 必须单独用一个宏函数，在写完 h 之后调用；
#   直接写成本函数的宏行会拿到上一只的 h（实例化早于函数体执行）——v4.16 的首只马正是因此整函数失效。
function doom.nats:grp/apply/horse with storage doom.nats:grp
scoreboard players add $grp.mem doom.nats 1
