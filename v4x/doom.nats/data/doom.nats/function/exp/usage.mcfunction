# doom.nats:exp/usage —— 实验性层总览（引擎门 + 运行时刻开关）
tellraw @s [{"text":"=== doom.nats 实验性层（非原版能力）===","color":"gold"}]
tellraw @s [{"text":"引擎门：本产物（v4x）在 pack.mcmeta 里声明了 features ⇒ 世界没开对应实验性玩法时**整包被拒**。","color":"gray"}]
tellraw @s [{"text":"运行时刻开关：storage doom.nats:exp 的 enabled=1b 时实验性能力才生效；disable 一条命令回滚。","color":"gray"}]
tellraw @s [{"text":"非原版能力：when.near 关系条件 · on_spawn 演出钩子 · preset 预设。用法见 doom.nats:exp/help。","color":"gray"}]
