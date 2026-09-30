# doom.nats:debug/despawn_report —— 消失统计（接 doom.log）
function doom.log:info {message:"doom.nats 消失层：硬消失 128 格（WATER_AMBIENT 64 格）· 概率 1/40 每 20 tick"}
function doom.log:dump {key:"despawn.dice", message:"掷骰分母（等效每 tick 1/800）"}
tellraw @a [{"text":"[nats] 场上本包生成实体：","color":"gray"},{"selector":"@e[tag=doom.nats.spawned]"},{"text":"  持久：","color":"gray"},{"selector":"@e[tag=doom.nats.persistent]"}]
