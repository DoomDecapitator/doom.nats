# doom.nats:debug/reject_report —— 归因直方图：先把数值打进日志，再清零
#
# 输出（机器可读，collect.mjs 抽 [nats.reject] / [nats.light] 前缀）：
#   [nats.reject] rej: 0=<n> 1=<n> … 8=<n> spawned=<n>
#   [nats.light] tier: 0=<n> 3=<n> 7=<n> 11=<n> 15=<n>   ← 光照失败时命中的档位
# reason 编码（对齐 docs/11 的合法性链）：
#   0=抽不到合格区块 · 1=24 格内有玩家 · 2=出 128 格 · 3=光照档不足 · 4=落位方块不允许
#   5=全局容量已满 · 6=附近玩家本地容量全满 · 7=刷怪密度（spawn cost）超限 · 8=选不到物种 · 9=该生物自身的规则不满足
#   10=世界出生点 24 格内（v4.17：$cfg.spawn24=1 且作者声明了 spawnX/Y/Z 时才可能出现）
#   11=世界边界外（v4.20：$cfg.border_size>0 且候选点在声明边界外时才可能出现，见 check/border）
function doom.log:info {code:"E914", message:"doom.nats 生成失败归因（自上次清零；打印后清零）"}
# 先把计数器建出来（add 0 不改变已有值）：从未出现过的分数在 tellraw 里会渲染成空字符串
scoreboard players add $spawned doom.nats 0
scoreboard players add $rej.0 doom.nats 0
scoreboard players add $rej.1 doom.nats 0
scoreboard players add $rej.2 doom.nats 0
scoreboard players add $rej.3 doom.nats 0
scoreboard players add $rej.4 doom.nats 0
scoreboard players add $rej.5 doom.nats 0
scoreboard players add $rej.6 doom.nats 0
scoreboard players add $rej.7 doom.nats 0
scoreboard players add $rej.8 doom.nats 0
scoreboard players add $rej.9 doom.nats 0
scoreboard players add $rej.10 doom.nats 0
scoreboard players add $rej.11 doom.nats 0
# ⚠ 已知偏差（v4.17 记录，未改）：$rej.8 / $rej.9 只 add 不 set ⇒ 这两个计数器**从不归零**，
#   快照行里它们是"世界生命期累计"。reason=10 按语义照常清零（见下）。
scoreboard players add $lit.0 doom.nats 0
scoreboard players add $lit.3 doom.nats 0
scoreboard players add $lit.7 doom.nats 0
scoreboard players add $lit.8 doom.nats 0
scoreboard players add $lit.9 doom.nats 0
scoreboard players add $lit.11 doom.nats 0
scoreboard players add $lit.15 doom.nats 0
# —— 日志通道 ——
execute store result storage doom.nats:rep r0 int 1 run scoreboard players get $rej.0 doom.nats
execute store result storage doom.nats:rep r1 int 1 run scoreboard players get $rej.1 doom.nats
execute store result storage doom.nats:rep r2 int 1 run scoreboard players get $rej.2 doom.nats
execute store result storage doom.nats:rep r3 int 1 run scoreboard players get $rej.3 doom.nats
execute store result storage doom.nats:rep r4 int 1 run scoreboard players get $rej.4 doom.nats
execute store result storage doom.nats:rep r5 int 1 run scoreboard players get $rej.5 doom.nats
execute store result storage doom.nats:rep r6 int 1 run scoreboard players get $rej.6 doom.nats
execute store result storage doom.nats:rep r7 int 1 run scoreboard players get $rej.7 doom.nats
execute store result storage doom.nats:rep r8 int 1 run scoreboard players get $rej.8 doom.nats
execute store result storage doom.nats:rep r9 int 1 run scoreboard players get $rej.9 doom.nats
execute store result storage doom.nats:rep r10 int 1 run scoreboard players get $rej.10 doom.nats
execute store result storage doom.nats:rep r11 int 1 run scoreboard players get $rej.11 doom.nats
execute store result storage doom.nats:rep t0 int 1 run scoreboard players get $lit.0 doom.nats
execute store result storage doom.nats:rep t3 int 1 run scoreboard players get $lit.3 doom.nats
execute store result storage doom.nats:rep t7 int 1 run scoreboard players get $lit.7 doom.nats
execute store result storage doom.nats:rep t8 int 1 run scoreboard players get $lit.8 doom.nats
execute store result storage doom.nats:rep t9 int 1 run scoreboard players get $lit.9 doom.nats
execute store result storage doom.nats:rep t11 int 1 run scoreboard players get $lit.11 doom.nats
execute store result storage doom.nats:rep t15 int 1 run scoreboard players get $lit.15 doom.nats
execute store result storage doom.nats:rep spawned int 1 run scoreboard players get $spawned doom.nats
function doom.nats:debug/say_report with storage doom.nats:rep
tellraw @a [{"text":"[nats.reject] ","color":"dark_gray"},{"text":"rej: ","color":"gray"},{"text":"0=","color":"gray"},{"score":{"name":"$rej.0","objective":"doom.nats"}},{"text":" 1=","color":"gray"},{"score":{"name":"$rej.1","objective":"doom.nats"}},{"text":" 2=","color":"gray"},{"score":{"name":"$rej.2","objective":"doom.nats"}},{"text":" 3=","color":"gray"},{"score":{"name":"$rej.3","objective":"doom.nats"}},{"text":" 4=","color":"gray"},{"score":{"name":"$rej.4","objective":"doom.nats"}},{"text":" 5=","color":"gray"},{"score":{"name":"$rej.5","objective":"doom.nats"}},{"text":" 6=","color":"gray"},{"score":{"name":"$rej.6","objective":"doom.nats"}},{"text":" 7=","color":"gray"},{"score":{"name":"$rej.7","objective":"doom.nats"}},{"text":" 8=","color":"gray"},{"score":{"name":"$rej.8","objective":"doom.nats"}},{"text":" 9=","color":"gray"},{"score":{"name":"$rej.9","objective":"doom.nats"}},{"text":" 10=","color":"gray"},{"score":{"name":"$rej.10","objective":"doom.nats"}},{"text":" 11=","color":"gray"},{"score":{"name":"$rej.11","objective":"doom.nats"}},{"text":" spawned=","color":"gray"},{"score":{"name":"$spawned","objective":"doom.nats"}}]
tellraw @a [{"text":"[nats.light] ","color":"dark_gray"},{"text":"tier: ","color":"gray"},{"text":"0=","color":"gray"},{"score":{"name":"$lit.0","objective":"doom.nats"}},{"text":" 3=","color":"gray"},{"score":{"name":"$lit.3","objective":"doom.nats"}},{"text":" 7=","color":"gray"},{"score":{"name":"$lit.7","objective":"doom.nats"}},{"text":" 8=","color":"gray"},{"score":{"name":"$lit.8","objective":"doom.nats"}},{"text":" 9=","color":"gray"},{"score":{"name":"$lit.9","objective":"doom.nats"}},{"text":" 11=","color":"gray"},{"score":{"name":"$lit.11","objective":"doom.nats"}},{"text":" 15=","color":"gray"},{"score":{"name":"$lit.15","objective":"doom.nats"}}]
scoreboard players set $spawned doom.nats 0
scoreboard players set $rej.0 doom.nats 0
scoreboard players set $rej.1 doom.nats 0
scoreboard players set $rej.2 doom.nats 0
scoreboard players set $rej.3 doom.nats 0
scoreboard players set $rej.4 doom.nats 0
scoreboard players set $rej.5 doom.nats 0
scoreboard players set $rej.6 doom.nats 0
scoreboard players set $rej.7 doom.nats 0
scoreboard players set $rej.10 doom.nats 0
scoreboard players set $rej.11 doom.nats 0
scoreboard players set $lit.0 doom.nats 0
scoreboard players set $lit.3 doom.nats 0
scoreboard players set $lit.7 doom.nats 0
scoreboard players set $lit.8 doom.nats 0
scoreboard players set $lit.9 doom.nats 0
scoreboard players set $lit.11 doom.nats 0
scoreboard players set $lit.15 doom.nats 0
