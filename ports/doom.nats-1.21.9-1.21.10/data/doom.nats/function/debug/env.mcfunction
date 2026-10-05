# doom.nats:debug:env —— 环境探针（单/多/服务器差异一目了然，输出走 doom.log）
function doom.nats:circ/snapshot
function doom.log:dump {key:"players", message:"doom.nats 快照"}
function doom.log:dump {key:"weather", message:"0=晴 1=雨 2=雷暴"}
function doom.log:dump {key:"chunks", message:"17x17 范围内已加载区块数（实测）"}
function doom.log:dump {key:"phase", message:"月相 0..7"}
function doom.log:dump {key:"dim", message:"0=主世界 1=下界 2=末地"}
# 日志通道（say 会进服务器日志；tellraw 在**无真人玩家**的专用服务器上不落盘 ⇒ 自动化采不到）
execute store result storage doom.nats:rep players int 1 run scoreboard players get $snap.players doom.nats
execute store result storage doom.nats:rep chunks int 1 run scoreboard players get $snap.chunks doom.nats
execute store result storage doom.nats:rep weather int 1 run scoreboard players get $snap.weather doom.nats
execute store result storage doom.nats:rep phase int 1 run scoreboard players get $snap.phase doom.nats
execute store result storage doom.nats:rep dim int 1 run scoreboard players get $snap.dim doom.nats
function doom.nats:debug/say_env with storage doom.nats:rep
tellraw @a [{"text":"[nats.env] ","color":"dark_gray"},{"text":"players=","color":"gray"},{"score":{"name":"$snap.players","objective":"doom.nats"},"color":"white"},{"text":" chunks=","color":"gray"},{"score":{"name":"$snap.chunks","objective":"doom.nats"},"color":"white"},{"text":" weather=","color":"gray"},{"score":{"name":"$snap.weather","objective":"doom.nats"},"color":"white"},{"text":" phase=","color":"gray"},{"score":{"name":"$snap.phase","objective":"doom.nats"},"color":"white"},{"text":" dim=","color":"gray"},{"score":{"name":"$snap.dim","objective":"doom.nats"},"color":"white"}]
