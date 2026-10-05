# doom.nats:check/setup —— 合法性链的常量
scoreboard players set #289 doom.nats 289
scoreboard players set #24 doom.nats 24
scoreboard players set #128 doom.nats 128
# v4.17：出生点 24 格排除的整数距离用（4d² = 4dx² + (2dy+1)² + 4dz²，见 check/spawn24_near）
scoreboard players set #2 doom.nats 2
scoreboard players set #4 doom.nats 4
# 各类别的 maxInstancesPerChunk（源码确证：monster 70 / creature 10 / ambient 15）
scoreboard players set #cap.monster doom.nats 70
scoreboard players set #cap.creature doom.nats 10
scoreboard players set #cap.ambient doom.nats 15
# v4.24 运行时刻作者层：条件条目的权重区间（#wsum 之后的 #off..#hi）
scoreboard players set #off doom.nats 0
scoreboard players set #hi doom.nats 0
# 海平面相关的窗口不在 setup 里写死：由 check/sealevel 每拍按 $cfg.sealevel 折算（v4.14）
#   （原版 getSeaLevel() 来自噪声设置：主世界 63 / 下界 32 / 末地 0；cfg 层可按维度给值）
function doom.nats:check/sealevel
function doom.nats:check/cost_setup
