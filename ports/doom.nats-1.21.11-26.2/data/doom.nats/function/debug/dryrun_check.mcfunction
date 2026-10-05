# doom.nats:debug/dryrun_check —— 在候选点逐步判定并打印（复用生产用的 check/*，不另写一套）
scoreboard players set $chk.ok doom.nats 1
scoreboard players set $chk.reason doom.nats 0

# ⓪ v4.22：先刷新"本次尝试的维度"$att.dim —— debug 路径不走 spawn/try_at（那条链由 pos/ctx 刷新），
#   不刷的话 check/cap 会拿**上一次尝试/上一个维度**的 $cnt.<cat> 去比容量（实测：下界脚本跑完后
#   在只刷新了一次的主世界直接跑 dryrun，容量门读的是下界计数 ⇒ 报 r5 假红）。
function doom.nats:circ/detect_dim_att

# ① 距离：24 格内有人就拒（对齐 distSq <= 576）
execute if entity @a[gamemode=!spectator,distance=..24] run function doom.nats:check/fail {reason:1}

# ② 群系探测 + 选物种（对齐 getRandomSpawnMobAt 的位置：在距离检查之后、合法性之前）
execute at @s run function doom.nats:biome/detect
scoreboard players set $sel.ok doom.nats 0
execute if score $chk.ok doom.nats matches 1 run function doom.nats:biome/dispatch
execute if score $chk.ok doom.nats matches 1 unless score $sel.ok doom.nats matches 1 run scoreboard players set $chk.ok doom.nats 0

# ③ 落位：三处方块判定分别记分，便于看出是哪一处不过
scoreboard players set $dr.at doom.nats 0
scoreboard players set $dr.above doom.nats 0
scoreboard players set $dr.below doom.nats 0
execute if block ~ ~ ~ #doom.nats:spawnable_at run scoreboard players set $dr.at doom.nats 1
execute if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $dr.above doom.nats 1
execute if block ~ ~-1 ~ #doom.nats:standable run scoreboard players set $dr.below doom.nats 1
execute if score $dr.at doom.nats matches 0 run function doom.nats:check/fail {reason:4}
execute if score $chk.ok doom.nats matches 1 if score $dr.above doom.nats matches 0 run function doom.nats:check/fail {reason:4}
execute if score $chk.ok doom.nats matches 1 if score $dr.below doom.nats matches 0 run function doom.nats:check/fail {reason:4}

# ④ 光照与容量（这两步依赖前面的结果，放在最后跑）
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/light
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/cap with storage doom.nats:sel

# ⑤ 汇总打印（同时进 doom.log 供 collect.mjs 采集）
function doom.log:dump {key:"chk.ok", message:"1=全部通过（就会生成）0=被某一步拒了"}
function doom.log:dump {key:"chk.reason", message:"0抽点 1距离24 2出128 3光照 4落位方块 5全局容量 6本地容量"}
function doom.log:dump {key:"sel.ok", message:"1=该位置有可选物种"}
function doom.log:dump {key:"dr.block", message:"at/above/below：三处方块判定（1=通过）"}
tellraw @a [{"text":"[dryrun] ","color":"gold"},{"text":"ok=","color":"gray"},{"score":{"name":"$chk.ok","objective":"doom.nats"},"color":"white"},{"text":" reason=","color":"gray"},{"score":{"name":"$chk.reason","objective":"doom.nats"},"color":"white"},{"text":" 物种=","color":"gray"},{"nbt":"type","storage":"doom.nats:sel","color":"aqua"},{"text":" 类别=","color":"gray"},{"nbt":"cat","storage":"doom.nats:sel","color":"aqua"}]
tellraw @a [{"text":"[dryrun] ","color":"gold"},{"text":"落位 at/above/below = ","color":"gray"},{"score":{"name":"$dr.at","objective":"doom.nats"},"color":"white"},{"text":"/","color":"gray"},{"score":{"name":"$dr.above","objective":"doom.nats"},"color":"white"},{"text":"/","color":"gray"},{"score":{"name":"$dr.below","objective":"doom.nats"},"color":"white"},{"text":"   光照档=","color":"gray"},{"score":{"name":"$chk.lighttier","objective":"doom.nats"},"color":"white"},{"text":"  计数/上限=","color":"gray"},{"score":{"name":"$cnt.monster","objective":"doom.nats"},"color":"white"},{"text":"/","color":"gray"},{"score":{"name":"$cap.monster","objective":"doom.nats"},"color":"white"}]
