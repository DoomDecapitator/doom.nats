# doom.nats:circ/detect_dim_att —— 判定**本次尝试**所在维度（写 $att.dim：0 主世界 / 1 下界 / 2 末地）
#
# 由 pos/ctx 在选中玩家（at @s）之后调用；check/cap 与 check/sealevel 读它取 per-dim 参数。
# 与 circ/detect_dim（写 $snap.dim，供快照/情形层用）**分开**，避免快照在尝试中途改写维度。
scoreboard players set $att.dim doom.nats 0
execute if dimension minecraft:the_nether run scoreboard players set $att.dim doom.nats 1
execute if dimension minecraft:the_end run scoreboard players set $att.dim doom.nats 2
