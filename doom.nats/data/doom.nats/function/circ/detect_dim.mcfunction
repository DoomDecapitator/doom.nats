# doom.nats:circ/detect_dim —— 判定**执行位置**所在维度（写 $snap.dim：0 主世界 / 1 下界 / 2 末地）
scoreboard players set $snap.dim doom.nats 0
execute if dimension minecraft:the_nether run scoreboard players set $snap.dim doom.nats 1
execute if dimension minecraft:the_end run scoreboard players set $snap.dim doom.nats 2
